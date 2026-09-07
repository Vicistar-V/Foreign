-- STEP 4: Recreate the dropped core functions

-- 4A: atomic_wallet_transfer
CREATE OR REPLACE FUNCTION public.atomic_wallet_transfer(_user_id uuid, _from_wallet wallet_type, _to_wallet wallet_type, _amount numeric, _description text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_source_balance DECIMAL(12, 2);
  v_debit_id UUID;
  v_credit_id UUID;
BEGIN
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be positive';
  END IF;
  
  IF _from_wallet = 'system' OR _to_wallet = 'system' THEN
    RAISE EXCEPTION 'Cannot transfer to/from system wallet';
  END IF;
  
  IF _from_wallet = 'credits' OR _to_wallet = 'credits' THEN
    RAISE EXCEPTION 'Credits cannot be transferred. They can only be used for drops.';
  END IF;
  
  IF _from_wallet = _to_wallet THEN
    RAISE EXCEPTION 'Source and destination wallets must be different';
  END IF;
  
  PERFORM * FROM public.transactions 
  WHERE user_id = _user_id AND wallet_type = _from_wallet
  FOR UPDATE;
  
  SELECT public.check_balance(_user_id, _from_wallet) INTO v_source_balance;
  
  IF v_source_balance < _amount THEN
    RAISE EXCEPTION 'Insufficient funds in % wallet. Available: ₦%, Requested: ₦%',
      _from_wallet, v_source_balance, _amount;
  END IF;
  
  INSERT INTO public.transactions (
    user_id, wallet_type, amount, transaction_type, description, status, metadata
  ) VALUES (
    _user_id, _from_wallet, -_amount, 'debt_reversal',
    _description || ' (Transfer OUT)', 'completed',
    jsonb_build_object('transfer_type', 'internal', 'from_wallet', _from_wallet, 'to_wallet', _to_wallet, 'timestamp', NOW())
  )
  RETURNING id INTO v_debit_id;
  
  INSERT INTO public.transactions (
    user_id, wallet_type, amount, transaction_type, description, status, metadata
  ) VALUES (
    _user_id, _to_wallet, _amount, 'debt_reversal',
    _description || ' (Transfer IN)', 'completed',
    jsonb_build_object('transfer_type', 'internal', 'from_wallet', _from_wallet, 'to_wallet', _to_wallet, 'linked_transaction', v_debit_id, 'timestamp', NOW())
  )
  RETURNING id INTO v_credit_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'debit_transaction_id', v_debit_id,
    'credit_transaction_id', v_credit_id,
    'amount', _amount,
    'from_wallet', _from_wallet,
    'to_wallet', _to_wallet,
    'new_source_balance', v_source_balance - _amount
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Transfer failed: %', SQLERRM;
END;
$function$;

-- 4B: atomic_initiate_withdrawal
CREATE OR REPLACE FUNCTION public.atomic_initiate_withdrawal(_user_id uuid, _amount numeric, _fee numeric, _reference text, _bank_name text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_earnings_balance DECIMAL;
  v_transfer_amount DECIMAL;
BEGIN
  SELECT earnings_balance INTO v_earnings_balance
  FROM user_balances
  WHERE user_id = _user_id
  FOR UPDATE;
  
  IF v_earnings_balance < _amount THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;
  
  v_transfer_amount := _amount - _fee;
  
  INSERT INTO transactions (
    user_id, wallet_type, amount, transaction_type, description, payment_reference, status, metadata
  ) VALUES (
    _user_id, 'earnings', -_amount, 'withdrawal',
    'Withdrawal to ' || _bank_name, _reference, 'pending',
    jsonb_build_object('withdrawal_fee', _fee, 'transfer_amount', v_transfer_amount, 'full_amount', _amount)
  );
  
  INSERT INTO transactions (
    user_id, wallet_type, amount, transaction_type, description, status, metadata
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', 'earnings', _fee, 'platform_fee',
    'Withdrawal fee income (Ref: ' || _reference || ')', 'completed',
    jsonb_build_object('original_user_id', _user_id, 'original_amount', _amount, 'fee_amount', _fee, 'withdrawal_reference', _reference)
  );
  
  RETURN jsonb_build_object('success', true, 'reference', _reference, 'transfer_amount', v_transfer_amount, 'fee', _fee);

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Withdrawal initiation failed: %', SQLERRM;
END;
$function$;

-- 4C: atomic_admin_credit
CREATE OR REPLACE FUNCTION public.atomic_admin_credit(_user_id uuid, _amount numeric, _wallet_type wallet_type, _reason text, _admin_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_name TEXT;
BEGIN
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;
  
  IF _wallet_type NOT IN ('earnings', 'deposit', 'credits') THEN
    RAISE EXCEPTION 'Invalid wallet type';
  END IF;
  
  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = _user_id;
  
  IF v_user_name IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  INSERT INTO public.transactions (
    user_id, wallet_type, amount, transaction_type, description, status, metadata
  ) VALUES (
    _user_id, _wallet_type, _amount, 'membership_bonus',
    'Admin bonus: ' || _reason, 'completed',
    jsonb_build_object('admin_action', true, 'admin_id', _admin_id, 'reason', _reason, 'credited_at', NOW())
  );
  
  INSERT INTO public.transactions (
    user_id, wallet_type, amount, transaction_type, description, status, metadata
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', 'earnings', -_amount, 'admin_expense',
    'Admin expense: ' || _reason, 'completed',
    jsonb_build_object('admin_action', true, 'admin_id', _admin_id, 'beneficiary_id', _user_id, 'reason', _reason, 'expensed_at', NOW())
  );
  
  RETURN jsonb_build_object('success', true, 'user_name', v_user_name, 'amount', _amount, 'wallet_type', _wallet_type);
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Admin credit failed: %', SQLERRM;
END;
$function$;

-- 4D: atomic_chargeback_reversal
CREATE OR REPLACE FUNCTION public.atomic_chargeback_reversal(_referrer_id uuid, _banned_user_id uuid, _reference text, _cash_amount numeric, _credit_amount numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _cash_amount <= 0 OR _credit_amount <= 0 THEN
    RAISE EXCEPTION 'Amounts must be positive';
  END IF;
  
  INSERT INTO public.transactions (
    user_id, wallet_type, amount, transaction_type, description, status, metadata
  ) VALUES (
    _referrer_id, 'earnings', -_cash_amount, 'debt_reversal',
    'Chargeback reversal: Referred user disputed payment', 'completed',
    jsonb_build_object('chargeback_reference', _reference, 'banned_user_id', _banned_user_id, 'reason', 'chargeback', 'reversed_at', NOW())
  );
  
  INSERT INTO public.transactions (
    user_id, wallet_type, amount, transaction_type, description, status, metadata
  ) VALUES (
    _referrer_id, 'credits', -_credit_amount, 'debt_reversal',
    'Chargeback reversal: Discount voucher revoked', 'completed',
    jsonb_build_object('chargeback_reference', _reference, 'banned_user_id', _banned_user_id, 'reason', 'chargeback', 'reversed_at', NOW())
  );
  
  RETURN jsonb_build_object('success', true, 'referrer_id', _referrer_id, 'cash_reversed', _cash_amount, 'credits_reversed', _credit_amount, 'total_reversed', _cash_amount + _credit_amount);
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Chargeback reversal failed: %', SQLERRM;
END;
$function$;

-- 4E: process_referral_commission trigger function
CREATE OR REPLACE FUNCTION public.process_referral_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_referrer_id UUID;
  v_referred_by_code TEXT;
  v_config RECORD;
  v_original_user_id UUID;
BEGIN
  IF NEW.transaction_type != 'membership_fee' OR NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  v_original_user_id := (NEW.metadata->>'original_user_id')::uuid;
  
  IF v_original_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing original_user_id in metadata for membership_fee transaction';
  END IF;

  SELECT referral_cash_bonus, referral_credit_bonus, membership_fee, welcome_bonus
  INTO v_config FROM public.platform_config WHERE id = 1;

  IF NEW.amount != v_config.membership_fee THEN
    RAISE EXCEPTION 'Amount mismatch: expected %, got %', v_config.membership_fee, NEW.amount;
  END IF;

  SELECT referred_by_code INTO v_referred_by_code FROM public.profiles WHERE id = v_original_user_id;

  IF v_referred_by_code IS NOT NULL AND v_referred_by_code != '' AND v_referred_by_code != 'SYSTEM' THEN
    SELECT id INTO v_referrer_id FROM public.profiles WHERE referral_code = v_referred_by_code;

    IF v_referrer_id IS NOT NULL THEN
      INSERT INTO public.transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
      VALUES (v_referrer_id, 'earnings', v_config.referral_cash_bonus, 'membership_bonus', 'Referral bonus for inviting new member', 'completed',
        jsonb_build_object('original_user_id', v_original_user_id, 'referral_code', v_referred_by_code));

      INSERT INTO public.transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
      VALUES ('00000000-0000-0000-0000-000000000000', 'earnings', -v_config.referral_cash_bonus, 'referral_payout', 'Cash commission paid to referrer', 'completed',
        jsonb_build_object('beneficiary_id', v_referrer_id, 'original_user_id', v_original_user_id, 'referral_code', v_referred_by_code));

      INSERT INTO public.transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
      VALUES (v_referrer_id, 'credits', v_config.referral_credit_bonus, 'membership_bonus', 'Referral discount voucher for inviting new member', 'completed',
        jsonb_build_object('original_user_id', v_original_user_id, 'referral_code', v_referred_by_code));

      INSERT INTO public.transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
      VALUES ('00000000-0000-0000-0000-000000000000', 'earnings', -v_config.referral_credit_bonus, 'voucher_issuance', 'Discount voucher issued to referrer', 'completed',
        jsonb_build_object('beneficiary_id', v_referrer_id, 'voucher_amount', v_config.referral_credit_bonus, 'original_user_id', v_original_user_id));
    END IF;
  END IF;
  
  INSERT INTO public.transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES (v_original_user_id, 'credits', v_config.welcome_bonus, 'welcome_bonus', 'Welcome Bonus: 2 Free Drop Credits', 'completed',
    jsonb_build_object('membership_activation', true, 'credits_value', 2));

  INSERT INTO public.transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES ('00000000-0000-0000-0000-000000000000', 'earnings', -v_config.welcome_bonus, 'voucher_issuance', 'Welcome bonus issued to new member', 'completed',
    jsonb_build_object('beneficiary_id', v_original_user_id, 'bonus_type', 'welcome', 'credits_value', 2));
  
  UPDATE public.profiles SET is_member = true, is_name_locked = true WHERE id = v_original_user_id;

  RETURN NEW;
END;
$function$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_membership_fee_paid ON transactions;
CREATE TRIGGER on_membership_fee_paid
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION process_referral_commission();

-- Recreate the index
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON transactions(user_id, transaction_type);