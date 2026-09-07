-- =====================================================
-- ATOMIC TRANSACTION PROTECTION SYSTEM
-- Prevents partial state corruption during operations
-- =====================================================

-- Function 1: Atomic Join Drop (All-or-Nothing Entry)
CREATE OR REPLACE FUNCTION public.atomic_join_drop(
  _user_id UUID,
  _drop_date DATE,
  _entry_fee DECIMAL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_credits_balance DECIMAL;
  v_deposit_balance DECIMAL;
  v_earnings_balance DECIMAL;
  v_credit_amount DECIMAL := 0;
  v_deposit_amount DECIMAL := 0;
  v_earnings_amount DECIMAL := 0;
  v_remaining DECIMAL;
  v_entry_id UUID;
BEGIN
  -- Lock user's balances to prevent race conditions
  SELECT credits_balance, deposit_balance, earnings_balance
  INTO v_credits_balance, v_deposit_balance, v_earnings_balance
  FROM public.user_balances
  WHERE user_id = _user_id
  FOR UPDATE;
  
  -- Smart payment waterfall: Credits → Deposit → Earnings
  v_remaining := _entry_fee;
  
  IF v_credits_balance >= v_remaining THEN
    v_credit_amount := v_remaining;
    v_remaining := 0;
  ELSE
    v_credit_amount := v_credits_balance;
    v_remaining := v_remaining - v_credits_balance;
    
    IF v_deposit_balance >= v_remaining THEN
      v_deposit_amount := v_remaining;
      v_remaining := 0;
    ELSE
      v_deposit_amount := v_deposit_balance;
      v_remaining := v_remaining - v_deposit_balance;
      
      IF v_earnings_balance >= v_remaining THEN
        v_earnings_amount := v_remaining;
        v_remaining := 0;
      ELSE
        RAISE EXCEPTION 'Insufficient funds across all wallets';
      END IF;
    END IF;
  END IF;
  
  -- ALL INSERTS IN ONE ATOMIC BLOCK
  -- Debit credits
  IF v_credit_amount > 0 THEN
    INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status)
    VALUES (_user_id, 'credits', -v_credit_amount, 'drop_entry', 'Daily Drop entry - ' || _drop_date, 'completed');
    
    -- System funds credit redemption
    INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
    VALUES ('00000000-0000-0000-0000-000000000000', 'deposit', -v_credit_amount, 'credit_redemption', 
            'Platform funding for credit redemption - ' || _drop_date, 'completed',
            jsonb_build_object('drop_date', _drop_date, 'beneficiary_id', _user_id));
  END IF;
  
  -- Debit deposit
  IF v_deposit_amount > 0 THEN
    INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status)
    VALUES (_user_id, 'deposit', -v_deposit_amount, 'drop_entry', 'Daily Drop entry - ' || _drop_date, 'completed');
  END IF;
  
  -- Debit earnings
  IF v_earnings_amount > 0 THEN
    INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status)
    VALUES (_user_id, 'earnings', -v_earnings_amount, 'drop_entry', 'Daily Drop entry (from winnings) - ' || _drop_date, 'completed');
  END IF;
  
  -- Create drop entry
  INSERT INTO drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, metadata)
  VALUES (_user_id, _drop_date, _entry_fee, v_deposit_amount + v_earnings_amount, v_credit_amount, 'pending',
          jsonb_build_object('payment_breakdown', jsonb_build_object(
            'credits', v_credit_amount, 'deposit', v_deposit_amount, 'earnings', v_earnings_amount)))
  RETURNING id INTO v_entry_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'entry_id', v_entry_id,
    'payment', jsonb_build_object('credits', v_credit_amount, 'deposit', v_deposit_amount, 'earnings', v_earnings_amount)
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- ALL operations above are automatically ROLLED BACK
    RAISE EXCEPTION 'Join drop failed: %', SQLERRM;
END;
$$;

-- Function 2: Batch Credit Winners (All-or-Nothing Winner Payouts)
CREATE OR REPLACE FUNCTION public.batch_credit_winners(
  _winner_data JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_winner RECORD;
  v_today TEXT;
  v_credited_count INT := 0;
BEGIN
  v_today := CURRENT_DATE::TEXT;
  
  -- Process ALL winners in one transaction
  FOR v_winner IN SELECT * FROM jsonb_to_recordset(_winner_data) 
    AS x(user_id UUID, entry_id UUID, amount DECIMAL, tier TEXT, tier_rank INT)
  LOOP
    -- Credit winner
    INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
    VALUES (v_winner.user_id, 'earnings', v_winner.amount, 'drop_win',
            'Winner (' || UPPER(v_winner.tier) || ' Tier) - Daily Distribution ' || v_today, 'completed',
            jsonb_build_object('tier', v_winner.tier, 'tierRank', v_winner.tier_rank));
    
    -- Update entry status
    UPDATE drop_entries 
    SET result_status = 'beneficiary', win_amount = v_winner.amount, 
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('tier', v_winner.tier, 'tierRank', v_winner.tier_rank)
    WHERE id = v_winner.entry_id;
    
    -- Queue notification
    INSERT INTO event_queue (user_id, event_type, event_data, status)
    VALUES (v_winner.user_id, 'winner_alert', 
            jsonb_build_object('amount', v_winner.amount, 'date', v_today, 'tier', v_winner.tier), 'pending');
    
    v_credited_count := v_credited_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object('success', true, 'credited_count', v_credited_count);

EXCEPTION
  WHEN OTHERS THEN
    -- ALL winner credits rolled back - nobody gets partial payment
    RAISE EXCEPTION 'Batch credit failed: %', SQLERRM;
END;
$$;

-- Function 3: Batch Process Protected (All-or-Nothing Refunds)
CREATE OR REPLACE FUNCTION public.batch_process_protected(
  _protected_data JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_entry RECORD;
  v_today TEXT;
  v_processed_count INT := 0;
  v_breakdown JSONB;
BEGIN
  v_today := CURRENT_DATE::TEXT;
  
  FOR v_entry IN SELECT * FROM jsonb_to_recordset(_protected_data)
    AS x(user_id UUID, entry_id UUID, total_amount DECIMAL, payment_breakdown JSONB)
  LOOP
    v_breakdown := v_entry.payment_breakdown;
    
    -- Refund to each wallet as appropriate
    IF (v_breakdown->>'deposit')::DECIMAL > 0 THEN
      INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status)
      VALUES (v_entry.user_id, 'deposit', (v_breakdown->>'deposit')::DECIMAL, 'drop_refund',
              'Protected refund - Daily Distribution ' || v_today, 'completed');
    END IF;
    
    IF (v_breakdown->>'earnings')::DECIMAL > 0 THEN
      INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status)
      VALUES (v_entry.user_id, 'earnings', (v_breakdown->>'earnings')::DECIMAL, 'drop_refund',
              'Protected refund - Daily Distribution ' || v_today, 'completed');
    END IF;
    
    IF (v_breakdown->>'credits')::DECIMAL > 0 THEN
      INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status)
      VALUES (v_entry.user_id, 'credits', (v_breakdown->>'credits')::DECIMAL, 'drop_refund',
              'Protected refund - Daily Distribution ' || v_today, 'completed');
    END IF;
    
    -- Update entry
    UPDATE drop_entries SET result_status = 'protected' WHERE id = v_entry.entry_id;
    
    -- Queue notification
    INSERT INTO event_queue (user_id, event_type, event_data, status)
    VALUES (v_entry.user_id, 'refund_notice', 
            jsonb_build_object('amount', v_entry.total_amount, 'date', v_today), 'pending');
    
    v_processed_count := v_processed_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object('success', true, 'processed_count', v_processed_count);

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Batch protected processing failed: %', SQLERRM;
END;
$$;