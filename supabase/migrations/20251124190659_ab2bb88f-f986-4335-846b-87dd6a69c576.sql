-- =====================================================
-- ATOMIC WALLET TRANSFER FUNCTION
-- Purpose: Ensures both debit and credit happen together or fail together
-- Security: Can only be called by authenticated edge functions
-- =====================================================

CREATE OR REPLACE FUNCTION public.atomic_wallet_transfer(
  _user_id UUID,
  _from_wallet wallet_type,
  _to_wallet wallet_type,
  _amount DECIMAL(12, 2),
  _description TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_source_balance DECIMAL(12, 2);
  v_debit_id UUID;
  v_credit_id UUID;
BEGIN
  -- =====================================================
  -- VALIDATION CHECKS
  -- =====================================================
  
  -- Check 1: Amount must be positive
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be positive';
  END IF;
  
  -- Check 2: Cannot transfer to/from system wallet (user-initiated)
  IF _from_wallet = 'system' OR _to_wallet = 'system' THEN
    RAISE EXCEPTION 'Cannot transfer to/from system wallet';
  END IF;
  
  -- Check 3: Cannot transfer to/from credits wallet (user-initiated)
  -- Credits can only be earned through referrals, not transferred
  IF _from_wallet = 'credits' OR _to_wallet = 'credits' THEN
    RAISE EXCEPTION 'Credits cannot be transferred. They can only be used for drops.';
  END IF;
  
  -- Check 4: Source and destination must be different
  IF _from_wallet = _to_wallet THEN
    RAISE EXCEPTION 'Source and destination wallets must be different';
  END IF;
  
  -- =====================================================
  -- BALANCE CHECK (Prevent Overdraft)
  -- =====================================================
  
  SELECT COALESCE(SUM(amount), 0) INTO v_source_balance
  FROM public.transactions
  WHERE user_id = _user_id AND wallet_type = _from_wallet;
  
  IF v_source_balance < _amount THEN
    RAISE EXCEPTION 'Insufficient funds in % wallet. Available: ₦%, Requested: ₦%',
      _from_wallet, v_source_balance, _amount;
  END IF;
  
  -- =====================================================
  -- ATOMIC TRANSACTION PAIR (All or Nothing)
  -- =====================================================
  
  -- Transaction 1: DEBIT from source wallet (negative amount)
  INSERT INTO public.transactions (
    user_id,
    wallet_type,
    amount,
    transaction_type,
    description,
    status,
    metadata
  ) VALUES (
    _user_id,
    _from_wallet,
    -_amount,  -- NEGATIVE: Money leaving
    'debt_reversal',  -- Reusing existing type for internal transfers
    _description || ' (Transfer OUT)',
    'completed',
    jsonb_build_object(
      'transfer_type', 'internal',
      'from_wallet', _from_wallet,
      'to_wallet', _to_wallet,
      'timestamp', NOW()
    )
  )
  RETURNING id INTO v_debit_id;
  
  -- Transaction 2: CREDIT to destination wallet (positive amount)
  INSERT INTO public.transactions (
    user_id,
    wallet_type,
    amount,
    transaction_type,
    description,
    status,
    metadata
  ) VALUES (
    _user_id,
    _to_wallet,
    _amount,  -- POSITIVE: Money arriving
    'debt_reversal',  -- Reusing existing type for internal transfers
    _description || ' (Transfer IN)',
    'completed',
    jsonb_build_object(
      'transfer_type', 'internal',
      'from_wallet', _from_wallet,
      'to_wallet', _to_wallet,
      'linked_transaction', v_debit_id,
      'timestamp', NOW()
    )
  )
  RETURNING id INTO v_credit_id;
  
  -- =====================================================
  -- RETURN SUCCESS WITH TRANSACTION IDS
  -- =====================================================
  
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
    -- If ANY step fails, PostgreSQL automatically rolls back BOTH transactions
    RAISE EXCEPTION 'Transfer failed: %', SQLERRM;
END;
$$;

-- =====================================================
-- GRANT EXECUTE PERMISSION (Service Role Only)
-- =====================================================

REVOKE ALL ON FUNCTION public.atomic_wallet_transfer FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atomic_wallet_transfer TO service_role;

-- =====================================================
-- USAGE EXAMPLE (For Documentation)
-- =====================================================

-- This function is called ONLY by the transfer-between-wallets edge function
-- Example call:
-- SELECT atomic_wallet_transfer(
--   _user_id := '123e4567-e89b-12d3-a456-426614174000',
--   _from_wallet := 'deposit',
--   _to_wallet := 'earnings',
--   _amount := 500.00,
--   _description := 'Clearing account debt'
-- );