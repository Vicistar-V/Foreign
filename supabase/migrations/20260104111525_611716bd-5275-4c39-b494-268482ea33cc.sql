-- =====================================================
-- FIX: Safe Mode Virtual Outcomes (Marketing Expense)
-- Don't consume real pool tickets for new user plays
-- =====================================================

-- Step 1: Make outcome_id nullable for virtual outcomes
ALTER TABLE instant_play_history 
ALTER COLUMN outcome_id DROP NOT NULL;

-- Step 2: Update atomic_play_instant to use virtual outcomes for Safe Mode
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
  v_safe_mode_virtual BOOLEAN := FALSE;
  v_virtual_outcome_type TEXT;
  v_virtual_payout DECIMAL;
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
  -- STEP 3.5: SAFE MODE - Virtual "Marketing" Outcomes
  -- Play 1: Virtual REFUND (builds trust)
  -- Play 2: Virtual WIN ₦500 (the hook - trapped by min withdrawal)
  -- These DO NOT consume real pool tickets!
  -- =====================================================
  SELECT COUNT(*) INTO v_user_play_count
  FROM public.instant_play_history
  WHERE user_id = _user_id;
  
  IF v_user_play_count < 2 THEN
    v_safe_mode_active := TRUE;
    v_safe_mode_virtual := TRUE;
    
    IF v_user_play_count = 0 THEN
      -- PLAY 1: Virtual REFUND (Trust Builder)
      v_virtual_outcome_type := 'refund';
      v_virtual_payout := 200;
      
    ELSIF v_user_play_count = 1 THEN
      -- PLAY 2: Virtual WIN ₦500 (The Hook)
      v_virtual_outcome_type := 'standard_win';
      v_virtual_payout := 500;
    END IF;
  END IF;
  
  -- =====================================================
  -- STEP 4: Pick REAL outcome ONLY if NOT in Safe Mode
  -- =====================================================
  IF NOT v_safe_mode_virtual THEN
    SELECT * INTO v_outcome
    FROM public.instant_game_pool
    WHERE status = 'available'
      AND payout_amount <= v_max_payout_limit
    ORDER BY RANDOM()
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
    
    IF v_outcome IS NULL THEN
      SELECT COUNT(*) INTO v_available_count
      FROM public.instant_game_pool
      WHERE status = 'available';
      
      IF v_available_count = 0 THEN
        RAISE EXCEPTION 'No tickets available. Pool needs restocking.';
      ELSE
        RAISE EXCEPTION 'No outcomes available within current payout limit. Please try again.';
      END IF;
    END IF;
    
    -- Mark REAL outcome as USED
    UPDATE public.instant_game_pool
    SET status = 'used',
        used_by = _user_id,
        used_at = now()
    WHERE id = v_outcome.id;
  END IF;
  
  -- =====================================================
  -- STEP 5: Debit user's wallet(s)
  -- =====================================================
  IF v_credit_amount > 0 THEN
    INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status)
    VALUES (_user_id, 'credits', -v_credit_amount, 'drop_entry', 'Instant Play entry', 'completed');
    
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
  -- STEP 6: Credit SYSTEM_TREASURY with entry fee
  -- =====================================================
  INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES ('00000000-0000-0000-0000-000000000000', 'earnings', _entry_fee, 'platform_fee',
          'Instant Play entry fee', 'completed',
          jsonb_build_object('player_id', _user_id, 'virtual_play', v_safe_mode_virtual));
  
  -- =====================================================
  -- STEP 7: Credit user based on outcome (Virtual or Real)
  -- =====================================================
  IF v_safe_mode_virtual THEN
    -- VIRTUAL OUTCOME: Credit user from "marketing budget"
    IF v_virtual_payout > 0 THEN
      IF v_virtual_outcome_type = 'refund' THEN
        INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
        VALUES (_user_id, 'credits', v_virtual_payout, 'drop_refund', 
                'Instant Play - Money Returned', 'completed',
                jsonb_build_object('outcome_type', v_virtual_outcome_type, 'safe_mode', true, 'virtual_outcome', true));
      ELSE
        INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
        VALUES (_user_id, 'earnings', v_virtual_payout, 'drop_win', 
                'Instant Play - You Won!', 'completed',
                jsonb_build_object('outcome_type', v_virtual_outcome_type, 'safe_mode', true, 'virtual_outcome', true));
      END IF;
      
      -- Debit SYSTEM_TREASURY as marketing expense
      INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
      VALUES ('00000000-0000-0000-0000-000000000000', 'earnings', -v_virtual_payout, 'admin_expense',
              'Safe Mode marketing payout (user acquisition)', 'completed',
              jsonb_build_object('beneficiary_id', _user_id, 'outcome_type', v_virtual_outcome_type, 'marketing_expense', true));
    END IF;
    
    -- Record virtual play history (NULL outcome_id)
    v_net_result := v_virtual_payout - _entry_fee;
    
    INSERT INTO instant_play_history (user_id, outcome_id, outcome_type, payout_amount, entry_fee, net_result)
    VALUES (_user_id, NULL, v_virtual_outcome_type, v_virtual_payout, _entry_fee, v_net_result)
    RETURNING id INTO v_history_id;
    
  ELSE
    -- REAL OUTCOME: Credit user from pool
    IF v_outcome.payout_amount > 0 THEN
      IF v_outcome.outcome_type = 'refund' THEN
        INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
        VALUES (_user_id, 'credits', v_outcome.payout_amount, 'drop_refund', 
                'Instant Play - Money Returned', 'completed',
                jsonb_build_object('outcome_type', v_outcome.outcome_type, 'outcome_id', v_outcome.id));
      ELSE
        INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
        VALUES (_user_id, 'earnings', v_outcome.payout_amount, 'drop_win', 
                'Instant Play - You Won!', 'completed',
                jsonb_build_object('outcome_type', v_outcome.outcome_type, 'outcome_id', v_outcome.id));
      END IF;
      
      -- Debit SYSTEM_TREASURY for real payout
      INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
      VALUES ('00000000-0000-0000-0000-000000000000', 'earnings', -v_outcome.payout_amount, 'subsidy',
              'Instant Play payout to user', 'completed',
              jsonb_build_object('beneficiary_id', _user_id, 'outcome_type', v_outcome.outcome_type));
    END IF;
    
    -- Record real play history
    v_net_result := v_outcome.payout_amount - _entry_fee;
    
    INSERT INTO instant_play_history (user_id, outcome_id, outcome_type, payout_amount, entry_fee, net_result)
    VALUES (_user_id, v_outcome.id, v_outcome.outcome_type, v_outcome.payout_amount, _entry_fee, v_net_result)
    RETURNING id INTO v_history_id;
  END IF;
  
  -- =====================================================
  -- STEP 8: Check if pool needs restocking
  -- =====================================================
  SELECT COUNT(*) INTO v_available_count
  FROM public.instant_game_pool
  WHERE status = 'available';
  
  -- =====================================================
  -- RETURN RESULT
  -- =====================================================
  IF v_safe_mode_virtual THEN
    RETURN jsonb_build_object(
      'success', true,
      'history_id', v_history_id,
      'outcome_type', v_virtual_outcome_type,
      'payout_amount', v_virtual_payout,
      'entry_fee', _entry_fee,
      'net_result', v_net_result,
      'payment', jsonb_build_object('credits', v_credit_amount, 'deposit', v_deposit_amount, 'earnings', v_earnings_amount),
      'pool_remaining', v_available_count,
      'needs_restock', v_available_count < 200,
      'max_payout_limit', v_max_payout_limit,
      'safe_mode_active', true,
      'safe_mode_virtual', true,
      'user_play_count', v_user_play_count + 1
    );
  ELSE
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
      'safe_mode_active', false,
      'safe_mode_virtual', false,
      'user_play_count', v_user_play_count + 1
    );
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Instant play failed: %', SQLERRM;
END;
$function$;