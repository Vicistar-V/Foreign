
-- 1) Withdrawal: only debit the user, no system-side insert
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
  SELECT public.check_balance(_user_id, 'earnings') INTO v_earnings_balance;

  IF v_earnings_balance < _amount THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  v_transfer_amount := _amount - _fee;

  INSERT INTO transactions (
    user_id, wallet_type, amount, transaction_type, description, payment_reference, status, metadata
  ) VALUES (
    _user_id, 'earnings', -_amount, 'withdrawal',
    'Withdrawal to ' || _bank_name, _reference, 'pending',
    jsonb_build_object(
      'withdrawal_fee', _fee,
      'transfer_amount', v_transfer_amount,
      'full_amount', _amount
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'reference', _reference,
    'transfer_amount', v_transfer_amount,
    'fee', _fee
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Withdrawal initiation failed: %', SQLERRM;
END;
$function$;

-- 2) Admin credit: only credit the recipient, no system expense row
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

  IF _wallet_type NOT IN ('earnings', 'deposit') THEN
    RAISE EXCEPTION 'Invalid wallet type. Only earnings and deposit are allowed.';
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

  RETURN jsonb_build_object('success', true, 'user_name', v_user_name, 'amount', _amount, 'wallet_type', _wallet_type);

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Admin credit failed: %', SQLERRM;
END;
$function$;

-- 3) Chargeback reversal: only debit the referrer, no system treasury row
CREATE OR REPLACE FUNCTION public.atomic_chargeback_reversal(_referrer_id uuid, _banned_user_id uuid, _reference text, _cash_amount numeric, _credit_amount numeric DEFAULT 0)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _current_earnings numeric;
  _total_to_reverse numeric;
BEGIN
  _total_to_reverse := _cash_amount;

  SELECT COALESCE(SUM(amount), 0)
  INTO _current_earnings
  FROM transactions
  WHERE user_id = _referrer_id
    AND wallet_type = 'earnings'
    AND status = 'completed'
  FOR UPDATE;

  INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES (
    _referrer_id,
    'earnings',
    -_total_to_reverse,
    'debt_reversal',
    'Referral commission reversed due to chargeback',
    'completed',
    json_build_object(
      'reason', 'chargeback',
      'banned_user_id', _banned_user_id::text,
      'reference', _reference,
      'cash_reversed', _cash_amount
    )
  );

  RETURN json_build_object(
    'success', true,
    'total_reversed', _total_to_reverse,
    'cash_reversed', _cash_amount
  );
END;
$function$;

-- 4) Admin/machine fee: no-op since fee is implicitly kept by not paying it out
CREATE OR REPLACE FUNCTION public.pay_admin_fee(_drop_id uuid, _from_user_id uuid, _admin_fee numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Platform fee is retained by not crediting any user wallet.
  -- Fee details are already captured on the corresponding payout transaction metadata.
  RETURN;
END;
$function$;

-- 5) Delete placeholder system account (cascade-safe: no transactions reference it)
DELETE FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000000';
DELETE FROM auth.users     WHERE id = '00000000-0000-0000-0000-000000000000';
