-- ============================================
-- STEP 1: Drop the trigger FIRST (it depends on the function)
-- ============================================
DROP TRIGGER IF EXISTS trigger_update_user_balances ON public.transactions;
DROP TRIGGER IF EXISTS update_balances_on_transaction ON public.transactions;

-- ============================================
-- STEP 2: Now we can safely drop the old function
-- ============================================
DROP FUNCTION IF EXISTS public.update_user_balances();

-- ============================================
-- STEP 3: Rename table from user_balances to cached_balances
-- (This may have already succeeded from previous migration attempt)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_balances' AND table_schema = 'public') THEN
    ALTER TABLE public.user_balances RENAME TO cached_balances;
  END IF;
END $$;

-- ============================================
-- STEP 4: Create new trigger function with correct table name
-- ============================================
CREATE OR REPLACE FUNCTION public.update_cached_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_earnings_total DECIMAL(12, 2);
  v_deposit_total DECIMAL(12, 2);
  v_credits_total DECIMAL(12, 2);
BEGIN
  -- ============================================
  -- RECALCULATE from ALL transactions (not increment!)
  -- This is a CACHE - the real balance is in the transactions ledger
  -- ============================================
  
  SELECT COALESCE(SUM(amount), 0) INTO v_earnings_total
  FROM public.transactions
  WHERE user_id = NEW.user_id AND wallet_type = 'earnings';
  
  SELECT COALESCE(SUM(amount), 0) INTO v_deposit_total
  FROM public.transactions
  WHERE user_id = NEW.user_id AND wallet_type = 'deposit';
  
  SELECT COALESCE(SUM(amount), 0) INTO v_credits_total
  FROM public.transactions
  WHERE user_id = NEW.user_id AND wallet_type = 'credits';
  
  -- Update the CACHE with computed values
  INSERT INTO public.cached_balances (
    user_id, 
    earnings_balance, 
    deposit_balance, 
    credits_balance, 
    last_updated
  )
  VALUES (
    NEW.user_id,
    v_earnings_total,
    v_deposit_total,
    v_credits_total,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    earnings_balance = v_earnings_total,
    deposit_balance = v_deposit_total,
    credits_balance = v_credits_total,
    last_updated = now();
  
  RETURN NEW;
END;
$function$;

-- ============================================
-- STEP 5: Create the trigger with new function
-- ============================================
CREATE TRIGGER update_cached_balances_on_transaction
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_cached_balances();

-- ============================================
-- STEP 6: FIX CRITICAL BUG - atomic_initiate_withdrawal must use ledger
-- ============================================
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
  -- CRITICAL: Use check_balance() to get REAL ledger balance, NOT the cache!
  -- The cached_balances table is only for display purposes
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

-- ============================================
-- STEP 7: Update RLS policies for new table name
-- ============================================
DROP POLICY IF EXISTS "Users can view their own balance" ON public.cached_balances;

CREATE POLICY "Users can view their own cached balance"
ON public.cached_balances
FOR SELECT
USING (auth.uid() = user_id);

-- ============================================
-- STEP 8: Update handle_new_user to use new table name
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_referral_code TEXT;
BEGIN
  -- Generate unique referral code
  new_referral_code := UPPER(SUBSTRING(MD5(NEW.id::text || NOW()::text) FROM 1 FOR 8));
  
  INSERT INTO public.profiles (id, full_name, phone_number, referral_code, referred_by_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.raw_user_meta_data->>'phone_number',
    new_referral_code,
    NEW.raw_user_meta_data->>'referred_by_code'
  );
  
  -- Create cached_balances entry (cache for display purposes only)
  INSERT INTO public.cached_balances (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$function$;