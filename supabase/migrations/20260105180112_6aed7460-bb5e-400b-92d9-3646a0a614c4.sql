-- =====================================================
-- CREDITS SYSTEM REMOVAL MIGRATION
-- Removes credits_balance and related config columns
-- =====================================================

-- 1. Drop credits_balance column from cached_balances
ALTER TABLE public.cached_balances DROP COLUMN IF EXISTS credits_balance;

-- 2. Drop welcome_bonus and referral_credit_bonus from platform_config (if they exist)
ALTER TABLE public.platform_config DROP COLUMN IF EXISTS welcome_bonus;
ALTER TABLE public.platform_config DROP COLUMN IF EXISTS referral_credit_bonus;

-- 3. Update update_cached_balances function to remove credits calculation
CREATE OR REPLACE FUNCTION public.update_cached_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Calculate and cache balances for the user
  INSERT INTO cached_balances (user_id, earnings_balance, deposit_balance, last_updated)
  SELECT 
    COALESCE(NEW.user_id, OLD.user_id),
    COALESCE(SUM(CASE WHEN wallet_type = 'earnings' AND status = 'completed' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN wallet_type = 'deposit' AND status = 'completed' THEN amount ELSE 0 END), 0),
    now()
  FROM transactions
  WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
  ON CONFLICT (user_id) 
  DO UPDATE SET
    earnings_balance = EXCLUDED.earnings_balance,
    deposit_balance = EXCLUDED.deposit_balance,
    last_updated = now();
  
  RETURN NEW;
END;
$$;

-- 4. Update atomic_wallet_transfer to explicitly block credits
CREATE OR REPLACE FUNCTION public.atomic_wallet_transfer(
  _user_id uuid,
  _from_wallet wallet_type,
  _to_wallet wallet_type,
  _amount numeric,
  _description text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _from_balance numeric;
  _result json;
BEGIN
  -- Block any credits transfers
  IF _from_wallet = 'credits' OR _to_wallet = 'credits' THEN
    RETURN json_build_object('success', false, 'error', 'Credits wallet is deprecated');
  END IF;

  -- Lock and check source balance
  SELECT COALESCE(SUM(amount), 0)
  INTO _from_balance
  FROM transactions
  WHERE user_id = _user_id
    AND wallet_type = _from_wallet
    AND status = 'completed'
  FOR UPDATE;

  IF _from_balance < _amount THEN
    RETURN json_build_object(
      'success', false, 
      'error', format('Not enough money in your %s wallet', _from_wallet)
    );
  END IF;

  -- Create transfer out (negative)
  INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status)
  VALUES (_user_id, _from_wallet, -_amount, 'withdrawal', _description, 'completed');

  -- Create transfer in (positive)
  INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status)
  VALUES (_user_id, _to_wallet, _amount, 'deposit', _description, 'completed');

  RETURN json_build_object(
    'success', true,
    'transferred', _amount,
    'from_wallet', _from_wallet,
    'to_wallet', _to_wallet
  );
END;
$$;

-- 5. Update atomic_admin_credit to only allow earnings and deposit
CREATE OR REPLACE FUNCTION public.atomic_admin_credit(
  _admin_id uuid,
  _user_id uuid,
  _wallet_type wallet_type,
  _amount numeric,
  _reason text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result json;
BEGIN
  -- Only allow earnings and deposit wallets
  IF _wallet_type NOT IN ('earnings', 'deposit') THEN
    RETURN json_build_object('success', false, 'error', 'Only earnings or deposit wallets allowed');
  END IF;

  -- Create the credit transaction
  INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES (
    _user_id,
    _wallet_type,
    _amount,
    'subsidy',
    _reason,
    'completed',
    json_build_object('admin_id', _admin_id::text, 'reason', _reason)
  );

  -- Create matching system treasury debit
  INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    'earnings',
    -_amount,
    'admin_expense',
    format('Admin credit to user: %s', _reason),
    'completed',
    json_build_object('admin_id', _admin_id::text, 'beneficiary_id', _user_id::text)
  );

  RETURN json_build_object(
    'success', true,
    'amount', _amount,
    'wallet_type', _wallet_type
  );
END;
$$;

-- 6. Update atomic_chargeback_reversal to only handle cash (no credits)
CREATE OR REPLACE FUNCTION public.atomic_chargeback_reversal(
  _referrer_id uuid,
  _banned_user_id uuid,
  _reference text,
  _cash_amount numeric,
  _credit_amount numeric DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_earnings numeric;
  _total_to_reverse numeric;
BEGIN
  -- Only reverse cash (credits are deprecated)
  _total_to_reverse := _cash_amount;

  -- Lock referrer's earnings balance
  SELECT COALESCE(SUM(amount), 0)
  INTO _current_earnings
  FROM transactions
  WHERE user_id = _referrer_id
    AND wallet_type = 'earnings'
    AND status = 'completed'
  FOR UPDATE;

  -- Create debt reversal transaction (goes negative if needed)
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

  -- Credit system treasury
  INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    'earnings',
    _total_to_reverse,
    'debt_reversal',
    'Chargeback recovery from referrer',
    'completed',
    json_build_object('referrer_id', _referrer_id::text, 'reference', _reference)
  );

  RETURN json_build_object(
    'success', true,
    'total_reversed', _total_to_reverse,
    'cash_reversed', _cash_amount
  );
END;
$$;

-- 7. Update process_referral_commission to remove credits logic (only cash bonus)
CREATE OR REPLACE FUNCTION public.process_referral_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _referrer record;
  _new_member record;
  _config record;
BEGIN
  -- Only process on membership_fee transactions
  IF NEW.transaction_type != 'membership_fee' OR NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Get the new member's profile
  SELECT * INTO _new_member FROM profiles WHERE id = NEW.user_id;
  
  IF _new_member.referred_by_code IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get referrer
  SELECT * INTO _referrer FROM profiles WHERE referral_code = _new_member.referred_by_code;
  
  IF _referrer IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get platform config (only cash bonus now)
  SELECT referral_cash_bonus INTO _config FROM platform_config WHERE id = 1;

  -- Credit referrer with CASH bonus to earnings wallet
  INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES (
    _referrer.id,
    'earnings',
    COALESCE(_config.referral_cash_bonus, 500),
    'membership_bonus',
    format('Referral bonus: %s joined', _new_member.full_name),
    'completed',
    json_build_object(
      'referral_code', _new_member.referred_by_code,
      'referee_id', NEW.user_id::text,
      'referee_name', _new_member.full_name,
      'bonus_type', 'cash'
    )
  );

  -- Debit system treasury
  INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    'earnings',
    -COALESCE(_config.referral_cash_bonus, 500),
    'referral_payout',
    format('Referral commission paid to %s', _referrer.full_name),
    'completed',
    json_build_object('referrer_id', _referrer.id::text, 'referee_id', NEW.user_id::text)
  );

  -- Create notification for referrer
  INSERT INTO notifications (user_id, notification_type, title, message, metadata, link)
  VALUES (
    _referrer.id,
    'referral_bonus',
    'Referral Bonus!',
    format('%s joined using your link. You earned ₦%s!', _new_member.full_name, COALESCE(_config.referral_cash_bonus, 500)),
    json_build_object(
      'referee_name', _new_member.full_name,
      'bonus_amount', COALESCE(_config.referral_cash_bonus, 500)
    ),
    '/invite'
  );

  -- Mark commission as paid
  UPDATE profiles SET referral_commission_paid = true WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;