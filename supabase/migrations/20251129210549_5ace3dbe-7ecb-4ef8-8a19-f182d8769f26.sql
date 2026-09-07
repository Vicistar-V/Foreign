-- =====================================================
-- MASTER ATOMIC FUNCTION #1: COMPLETE DISTRIBUTION
-- Handles ALL distribution operations in ONE transaction
-- Platform Fee + Subsidy + Winners + Protected + Contributors
-- =====================================================
CREATE OR REPLACE FUNCTION public.atomic_process_distribution(
  _drop_date DATE,
  _platform_fee DECIMAL,
  _subsidy DECIMAL,
  _winner_data JSONB,
  _protected_data JSONB,
  _contributor_ids UUID[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_winner RECORD;
  v_protected RECORD;
  v_credited_count INT := 0;
  v_protected_count INT := 0;
  v_contributor_count INT := 0;
  v_breakdown JSONB;
BEGIN
  -- =====================================================
  -- STEP 1: Credit platform fee to SYSTEM_TREASURY
  -- =====================================================
  INSERT INTO transactions (
    user_id,
    wallet_type,
    amount,
    transaction_type,
    description,
    status
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'earnings',
    _platform_fee,
    'platform_fee',
    'Platform fee from distribution - ' || _drop_date,
    'completed'
  );
  
  -- =====================================================
  -- STEP 2: Debit subsidy from SYSTEM_TREASURY (if any)
  -- =====================================================
  IF _subsidy > 0 THEN
    INSERT INTO transactions (
      user_id,
      wallet_type,
      amount,
      transaction_type,
      description,
      status
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      'earnings',
      -_subsidy,
      'subsidy',
      'Minimum pool guarantee subsidy - ' || _drop_date,
      'completed'
    );
  END IF;
  
  -- =====================================================
  -- STEP 3: Credit ALL winners atomically
  -- =====================================================
  FOR v_winner IN SELECT * FROM jsonb_to_recordset(_winner_data) 
    AS x(user_id UUID, entry_id UUID, amount DECIMAL, tier TEXT, tier_rank INT)
  LOOP
    -- Credit winner
    INSERT INTO transactions (
      user_id,
      wallet_type,
      amount,
      transaction_type,
      description,
      status,
      metadata
    ) VALUES (
      v_winner.user_id,
      'earnings',
      v_winner.amount,
      'drop_win',
      'Winner (' || UPPER(v_winner.tier) || ' Tier) - Daily Distribution ' || _drop_date,
      'completed',
      jsonb_build_object('tier', v_winner.tier, 'tierRank', v_winner.tier_rank, 'drop_date', _drop_date)
    );
    
    -- Update entry status
    UPDATE drop_entries 
    SET 
      result_status = 'beneficiary',
      win_amount = v_winner.amount,
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('tier', v_winner.tier, 'tierRank', v_winner.tier_rank)
    WHERE id = v_winner.entry_id;
    
    -- Queue notification
    INSERT INTO event_queue (user_id, event_type, event_data, status)
    VALUES (
      v_winner.user_id,
      'winner_alert',
      jsonb_build_object('amount', v_winner.amount, 'date', _drop_date, 'tier', v_winner.tier),
      'pending'
    );
    
    v_credited_count := v_credited_count + 1;
  END LOOP;
  
  -- =====================================================
  -- STEP 4: Refund ALL protected users atomically
  -- =====================================================
  FOR v_protected IN SELECT * FROM jsonb_to_recordset(_protected_data)
    AS x(user_id UUID, entry_id UUID, total_amount DECIMAL, payment_breakdown JSONB)
  LOOP
    v_breakdown := v_protected.payment_breakdown;
    
    -- Refund to deposit wallet
    IF (v_breakdown->>'deposit')::DECIMAL > 0 THEN
      INSERT INTO transactions (
        user_id,
        wallet_type,
        amount,
        transaction_type,
        description,
        status
      ) VALUES (
        v_protected.user_id,
        'deposit',
        (v_breakdown->>'deposit')::DECIMAL,
        'drop_refund',
        'Protected refund - Daily Distribution ' || _drop_date,
        'completed'
      );
    END IF;
    
    -- Refund to earnings wallet
    IF (v_breakdown->>'earnings')::DECIMAL > 0 THEN
      INSERT INTO transactions (
        user_id,
        wallet_type,
        amount,
        transaction_type,
        description,
        status
      ) VALUES (
        v_protected.user_id,
        'earnings',
        (v_breakdown->>'earnings')::DECIMAL,
        'drop_refund',
        'Protected refund - Daily Distribution ' || _drop_date,
        'completed'
      );
    END IF;
    
    -- Refund to credits wallet
    IF (v_breakdown->>'credits')::DECIMAL > 0 THEN
      INSERT INTO transactions (
        user_id,
        wallet_type,
        amount,
        transaction_type,
        description,
        status
      ) VALUES (
        v_protected.user_id,
        'credits',
        (v_breakdown->>'credits')::DECIMAL,
        'drop_refund',
        'Protected refund - Daily Distribution ' || _drop_date,
        'completed'
      );
    END IF;
    
    -- Update entry
    UPDATE drop_entries SET result_status = 'protected' WHERE id = v_protected.entry_id;
    
    -- Queue notification
    INSERT INTO event_queue (user_id, event_type, event_data, status)
    VALUES (
      v_protected.user_id,
      'refund_notice',
      jsonb_build_object('amount', v_protected.total_amount, 'date', _drop_date),
      'pending'
    );
    
    v_protected_count := v_protected_count + 1;
  END LOOP;
  
  -- =====================================================
  -- STEP 5: Mark ALL contributors atomically
  -- =====================================================
  IF array_length(_contributor_ids, 1) > 0 THEN
    UPDATE drop_entries 
    SET result_status = 'contributor'
    WHERE id = ANY(_contributor_ids);
    
    GET DIAGNOSTICS v_contributor_count = ROW_COUNT;
  END IF;
  
  -- =====================================================
  -- RETURN SUCCESS WITH COUNTS
  -- =====================================================
  RETURN jsonb_build_object(
    'success', true,
    'winners_credited', v_credited_count,
    'protected_refunded', v_protected_count,
    'contributors_marked', v_contributor_count,
    'drop_date', _drop_date
  );

EXCEPTION
  WHEN OTHERS THEN
    -- ALL OPERATIONS ROLLED BACK - ZERO PARTIAL STATE
    RAISE EXCEPTION 'Distribution failed atomically: %', SQLERRM;
END;
$$;

-- =====================================================
-- MASTER ATOMIC FUNCTION #2: COMPLETE WITHDRAWAL
-- Handles ALL withdrawal operations in ONE transaction
-- User Debit + System Fee + Pending Record
-- =====================================================
CREATE OR REPLACE FUNCTION public.atomic_initiate_withdrawal(
  _user_id UUID,
  _amount DECIMAL,
  _fee DECIMAL,
  _reference TEXT,
  _bank_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_earnings_balance DECIMAL;
  v_transfer_amount DECIMAL;
BEGIN
  -- =====================================================
  -- LOCK AND VALIDATE BALANCE
  -- =====================================================
  SELECT earnings_balance INTO v_earnings_balance
  FROM user_balances
  WHERE user_id = _user_id
  FOR UPDATE;
  
  IF v_earnings_balance < _amount THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;
  
  v_transfer_amount := _amount - _fee;
  
  -- =====================================================
  -- STEP 1: Debit user the FULL amount
  -- =====================================================
  INSERT INTO transactions (
    user_id,
    wallet_type,
    amount,
    transaction_type,
    description,
    payment_reference,
    status,
    metadata
  ) VALUES (
    _user_id,
    'earnings',
    -_amount,
    'withdrawal',
    'Withdrawal to ' || _bank_name,
    _reference,
    'pending',
    jsonb_build_object(
      'withdrawal_fee', _fee,
      'transfer_amount', v_transfer_amount,
      'full_amount', _amount
    )
  );
  
  -- =====================================================
  -- STEP 2: Credit SYSTEM_TREASURY the fee
  -- =====================================================
  INSERT INTO transactions (
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
    _fee,
    'platform_fee',
    'Withdrawal fee income (Ref: ' || _reference || ')',
    'completed',
    jsonb_build_object(
      'original_user_id', _user_id,
      'original_amount', _amount,
      'fee_amount', _fee,
      'withdrawal_reference', _reference
    )
  );
  
  -- =====================================================
  -- RETURN SUCCESS WITH DETAILS
  -- =====================================================
  RETURN jsonb_build_object(
    'success', true,
    'reference', _reference,
    'transfer_amount', v_transfer_amount,
    'fee', _fee
  );

EXCEPTION
  WHEN OTHERS THEN
    -- ALL OPERATIONS ROLLED BACK
    RAISE EXCEPTION 'Withdrawal initiation failed: %', SQLERRM;
END;
$$;