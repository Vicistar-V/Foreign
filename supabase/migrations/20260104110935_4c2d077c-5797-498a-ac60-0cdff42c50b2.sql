-- Update atomic_play_instant to implement "Trust Builder → Hook" Safe Mode
-- Play 1: REFUND (builds trust)
-- Play 2: WIN ₦500 (creates the hook, trapped by min withdrawal)

CREATE OR REPLACE FUNCTION public.atomic_play_instant(_user_id uuid, _entry_fee numeric DEFAULT 200)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_credits_balance DECIMAL;
  v_deposit_balance DECIMAL;
  v_earnings_balance DECIMAL;
  v_credit_amount DECIMAL := 0;
  v_deposit_amount DECIMAL := 0;
  v_earnings_amount DECIMAL := 0;
  v_remaining DECIMAL;
  v_max_payout_limit DECIMAL;
  v_outcome RECORD;
  v_history_id UUID;
  v_available_count INTEGER;
  v_net_result DECIMAL;
  v_user_play_count INTEGER;
  v_safe_mode_active BOOLEAN := FALSE;
BEGIN
  -- =====================================================
  -- STEP 1: Lock user's balances to prevent race conditions
  -- =====================================================
  SELECT credits_balance, deposit_balance, earnings_balance
  INTO v_credits_balance, v_deposit_balance, v_earnings_balance
  FROM public.user_balances
  WHERE user_id = _user_id
  FOR UPDATE;
  
  -- =====================================================
  -- STEP 2: Smart payment waterfall: Credits → Deposit → Earnings
  -- =====================================================
  v_remaining := _entry_fee;
  
  IF v_credits_balance >= v_remaining THEN
    v_credit_amount := v_remaining;
    v_remaining := 0;
  ELSE
    v_credit_amount := GREATEST(v_credits_balance, 0);
    v_remaining := v_remaining - v_credit_amount;
    
    IF v_deposit_balance >= v_remaining THEN
      v_deposit_amount := v_remaining;
      v_remaining := 0;
    ELSE
      v_deposit_amount := GREATEST(v_deposit_balance, 0);
      v_remaining := v_remaining - v_deposit_amount;
      
      IF v_earnings_balance >= v_remaining THEN
        v_earnings_amount := v_remaining;
        v_remaining := 0;
      ELSE
        RAISE EXCEPTION 'Insufficient funds across all wallets';
      END IF;
    END IF;
  END IF;
  
  -- =====================================================
  -- STEP 3: Get max payout limit from config
  -- =====================================================
  SELECT COALESCE(instant_max_payout_limit, 5000) INTO v_max_payout_limit
  FROM public.platform_config WHERE id = 1;
  
  -- =====================================================
  -- STEP 3.5: SAFE MODE - "Trust Builder → Hook" Sequence
  -- Play 1: REFUND (builds trust - "my money came back")
  -- Play 2: WIN ₦500 (the hook - trapped by min withdrawal)
  -- =====================================================
  SELECT COUNT(*) INTO v_user_play_count
  FROM public.instant_play_history
  WHERE user_id = _user_id;
  
  -- Safe Mode for first 2 plays
  IF v_user_play_count < 2 THEN
    v_safe_mode_active := TRUE;
    
    IF v_user_play_count = 0 THEN
      -- PLAY 1: Force REFUND (Trust Builder)
      -- User sees their money come back - builds confidence
      SELECT * INTO v_outcome
      FROM public.instant_game_pool
      WHERE status = 'available'
        AND outcome_type = 'refund'
        AND payout_amount = 200
      ORDER BY RANDOM()
      LIMIT 1
      FOR UPDATE SKIP LOCKED;
      
    ELSIF v_user_play_count = 1 THEN
      -- PLAY 2: Force WIN ₦500 (The Hook)
      -- User sees profit but can't withdraw (min is ₦1,000)
      -- This creates "Partial Success Tension" - drives deposits
      SELECT * INTO v_outcome
      FROM public.instant_game_pool
      WHERE status = 'available'
        AND outcome_type = 'standard_win'
        AND payout_amount = 500
      ORDER BY RANDOM()
      LIMIT 1
      FOR UPDATE SKIP LOCKED;
    END IF;
    
    -- Fallback if specific outcome not available
    IF v_outcome IS NULL THEN
      SELECT * INTO v_outcome
      FROM public.instant_game_pool
      WHERE status = 'available'
        AND payout_amount > 0
        AND payout_amount <= v_max_payout_limit
      ORDER BY payout_amount ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED;
    END IF;
  END IF;
  
  -- =====================================================
  -- STEP 4: Pick an available outcome (ONLY if not in Safe Mode)
  -- =====================================================
  IF NOT v_safe_mode_active THEN
    SELECT * INTO v_outcome
    FROM public.instant_game_pool
    WHERE status = 'available'
      AND payout_amount <= v_max_payout_limit
    ORDER BY RANDOM()
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
  END IF;
  
  IF v_outcome IS NULL THEN
    -- Check if we need to restock
    SELECT COUNT(*) INTO v_available_count
    FROM public.instant_game_pool
    WHERE status = 'available';
    
    IF v_available_count = 0 THEN
      RAISE EXCEPTION 'No tickets available. Pool needs restocking.';
    ELSE
      RAISE EXCEPTION 'No outcomes available within current payout limit (₦%). Please try again or contact admin.', v_max_payout_limit;
    END IF;
  END IF;
  
  -- =====================================================
  -- STEP 5: Mark outcome as USED (consumed from deck)
  -- =====================================================
  UPDATE public.instant_game_pool
  SET status = 'used',
      used_by = _user_id,
      used_at = now()
  WHERE id = v_outcome.id;
  
  -- =====================================================
  -- STEP 6: Debit user's wallet(s)
  -- =====================================================
  IF v_credit_amount > 0 THEN
    INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status)
    VALUES (_user_id, 'credits', -v_credit_amount, 'drop_entry', 'Instant Play entry', 'completed');
    
    -- System funds credit redemption
    INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
    VALUES ('00000000-0000-0000-0000-000000000000', 'deposit', -v_credit_amount, 'credit_redemption', 
            'Platform funding for instant play credit redemption', 'completed',
            jsonb_build_object('beneficiary_id', _user_id));
  END IF;
  
  IF v_deposit_amount > 0 THEN
    INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status)
    VALUES (_user_id, 'deposit', -v_deposit_amount, 'drop_entry', 'Instant Play entry', 'completed');
  END IF;
  
  IF v_earnings_amount > 0 THEN
    INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status)
    VALUES (_user_id, 'earnings', -v_earnings_amount, 'drop_entry', 'Instant Play entry (from winnings)', 'completed');
  END IF;
  
  -- =====================================================
  -- STEP 7: Credit SYSTEM_TREASURY with entry fee (platform revenue)
  -- =====================================================
  INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES ('00000000-0000-0000-0000-000000000000', 'earnings', _entry_fee, 'platform_fee',
          'Instant Play entry fee', 'completed',
          jsonb_build_object('player_id', _user_id, 'outcome_id', v_outcome.id));
  
  -- =====================================================
  -- STEP 8: Credit user if they won (payout > 0)
  -- =====================================================
  IF v_outcome.payout_amount > 0 THEN
    -- Credit to credits for refunds, earnings for wins
    IF v_outcome.outcome_type = 'refund' THEN
      INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
      VALUES (_user_id, 'credits', v_outcome.payout_amount, 'drop_refund', 
              'Instant Play - Money Returned', 'completed',
              jsonb_build_object('outcome_type', v_outcome.outcome_type, 'outcome_id', v_outcome.id, 'safe_mode', v_safe_mode_active));
    ELSE
      INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
      VALUES (_user_id, 'earnings', v_outcome.payout_amount, 'drop_win', 
              'Instant Play - You Won!', 'completed',
              jsonb_build_object('outcome_type', v_outcome.outcome_type, 'outcome_id', v_outcome.id));
    END IF;
    
    -- Debit SYSTEM_TREASURY for payout
    INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
    VALUES ('00000000-0000-0000-0000-000000000000', 'earnings', -v_outcome.payout_amount, 'subsidy',
            'Instant Play payout to user', 'completed',
            jsonb_build_object('beneficiary_id', _user_id, 'outcome_type', v_outcome.outcome_type));
  END IF;
  
  -- =====================================================
  -- STEP 9: Record play history
  -- =====================================================
  v_net_result := v_outcome.payout_amount - _entry_fee;
  
  INSERT INTO instant_play_history (user_id, outcome_id, outcome_type, payout_amount, entry_fee, net_result)
  VALUES (_user_id, v_outcome.id, v_outcome.outcome_type, v_outcome.payout_amount, _entry_fee, v_net_result)
  RETURNING id INTO v_history_id;
  
  -- =====================================================
  -- STEP 10: Check if pool needs restocking
  -- =====================================================
  SELECT COUNT(*) INTO v_available_count
  FROM public.instant_game_pool
  WHERE status = 'available';
  
  -- =====================================================
  -- RETURN RESULT (with Safe Mode indicator)
  -- =====================================================
  RETURN jsonb_build_object(
    'success', true,
    'history_id', v_history_id,
    'outcome_type', v_outcome.outcome_type,
    'payout_amount', v_outcome.payout_amount,
    'entry_fee', _entry_fee,
    'net_result', v_net_result,
    'payment', jsonb_build_object('credits', v_credit_amount, 'deposit', v_deposit_amount, 'earnings', v_earnings_amount),
    'pool_remaining', v_available_count,
    'needs_restock', v_available_count < 200,
    'max_payout_limit', v_max_payout_limit,
    'safe_mode_active', v_safe_mode_active,
    'user_play_count', v_user_play_count + 1
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Instant play failed: %', SQLERRM;
END;
$function$;