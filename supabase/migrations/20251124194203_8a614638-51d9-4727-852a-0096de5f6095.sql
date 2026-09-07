-- =====================================================
-- FIX: Update atomic_wallet_transfer to use check_balance helper
-- and add row-level locking to prevent race conditions
-- =====================================================

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
SET search_path TO 'public'
AS $function$
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
  IF _from_wallet = 'credits' OR _to_wallet = 'credits' THEN
    RAISE EXCEPTION 'Credits cannot be transferred. They can only be used for drops.';
  END IF;
  
  -- Check 4: Source and destination must be different
  IF _from_wallet = _to_wallet THEN
    RAISE EXCEPTION 'Source and destination wallets must be different';
  END IF;
  
  -- =====================================================
  -- ROW-LEVEL LOCKING (Prevents Race Conditions)
  -- =====================================================
  
  -- Lock all of the user's transactions for the source wallet
  -- This forces consecutive transfers to execute sequentially
  -- preventing read-after-write race conditions
  PERFORM * FROM public.transactions 
  WHERE user_id = _user_id AND wallet_type = _from_wallet
  FOR UPDATE;
  
  -- =====================================================
  -- BALANCE CHECK (Using Helper Function)
  -- =====================================================
  
  -- Use the standardized check_balance helper instead of duplicate logic
  SELECT public.check_balance(_user_id, _from_wallet) INTO v_source_balance;
  
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
    -_amount,
    'debt_reversal',
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
    _amount,
    'debt_reversal',
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
    RAISE EXCEPTION 'Transfer failed: %', SQLERRM;
END;
$function$;