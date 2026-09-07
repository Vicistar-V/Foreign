-- =====================================================
-- ATOMIC ADMIN CREDIT FUNCTION
-- Handles both user credit AND system expense atomically
-- =====================================================

CREATE OR REPLACE FUNCTION public.atomic_admin_credit(
  _user_id UUID,
  _amount DECIMAL,
  _wallet_type wallet_type,
  _reason TEXT,
  _admin_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_name TEXT;
BEGIN
  -- =====================================================
  -- VALIDATION CHECKS
  -- =====================================================
  
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;
  
  IF _wallet_type NOT IN ('earnings', 'deposit', 'credits') THEN
    RAISE EXCEPTION 'Invalid wallet type';
  END IF;
  
  -- Get target user's name for response
  SELECT full_name INTO v_user_name
  FROM public.profiles
  WHERE id = _user_id;
  
  IF v_user_name IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- =====================================================
  -- ATOMIC TRANSACTION PAIR (All or Nothing)
  -- =====================================================
  
  -- STEP 1: Credit user
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
    _wallet_type,
    _amount,
    'membership_bonus',
    'Admin bonus: ' || _reason,
    'completed',
    jsonb_build_object(
      'admin_action', true,
      'admin_id', _admin_id,
      'reason', _reason,
      'credited_at', NOW()
    )
  );
  
  -- STEP 2: Debit SYSTEM_TREASURY (PROPER ACCOUNTING)
  INSERT INTO public.transactions (
    user_id,
    wallet_type,
    amount,
    transaction_type,
    description,
    status,
    metadata
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'earnings',
    -_amount,
    'admin_expense',
    'Admin expense: ' || _reason,
    'completed',
    jsonb_build_object(
      'admin_action', true,
      'admin_id', _admin_id,
      'beneficiary_id', _user_id,
      'reason', _reason,
      'expensed_at', NOW()
    )
  );
  
  -- =====================================================
  -- RETURN SUCCESS WITH DETAILS
  -- =====================================================
  
  RETURN jsonb_build_object(
    'success', true,
    'user_name', v_user_name,
    'amount', _amount,
    'wallet_type', _wallet_type
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- BOTH operations rolled back atomically
    RAISE EXCEPTION 'Admin credit failed: %', SQLERRM;
END;
$$;

-- =====================================================
-- ATOMIC CHARGEBACK REVERSAL FUNCTION
-- Handles both cash commission AND credit voucher reversal atomically
-- =====================================================

CREATE OR REPLACE FUNCTION public.atomic_chargeback_reversal(
  _referrer_id UUID,
  _banned_user_id UUID,
  _reference TEXT,
  _cash_amount DECIMAL,
  _credit_amount DECIMAL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- =====================================================
  -- VALIDATION CHECKS
  -- =====================================================
  
  IF _cash_amount <= 0 OR _credit_amount <= 0 THEN
    RAISE EXCEPTION 'Amounts must be positive';
  END IF;
  
  -- =====================================================
  -- ATOMIC REVERSAL PAIR (All or Nothing)
  -- =====================================================
  
  -- STEP 1: Reverse cash commission (create negative debt in earnings)
  INSERT INTO public.transactions (
    user_id,
    wallet_type,
    amount,
    transaction_type,
    description,
    status,
    metadata
  ) VALUES (
    _referrer_id,
    'earnings',
    -_cash_amount,
    'debt_reversal',
    'Chargeback reversal: Referred user disputed payment',
    'completed',
    jsonb_build_object(
      'chargeback_reference', _reference,
      'banned_user_id', _banned_user_id,
      'reason', 'chargeback',
      'reversed_at', NOW()
    )
  );
  
  -- STEP 2: Reverse credit vouchers (create negative debt in credits)
  INSERT INTO public.transactions (
    user_id,
    wallet_type,
    amount,
    transaction_type,
    description,
    status,
    metadata
  ) VALUES (
    _referrer_id,
    'credits',
    -_credit_amount,
    'debt_reversal',
    'Chargeback reversal: Discount voucher revoked',
    'completed',
    jsonb_build_object(
      'chargeback_reference', _reference,
      'banned_user_id', _banned_user_id,
      'reason', 'chargeback',
      'reversed_at', NOW()
    )
  );
  
  -- =====================================================
  -- RETURN SUCCESS WITH DETAILS
  -- =====================================================
  
  RETURN jsonb_build_object(
    'success', true,
    'referrer_id', _referrer_id,
    'cash_reversed', _cash_amount,
    'credits_reversed', _credit_amount,
    'total_reversed', _cash_amount + _credit_amount
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- BOTH reversals rolled back atomically
    RAISE EXCEPTION 'Chargeback reversal failed: %', SQLERRM;
END;
$$;