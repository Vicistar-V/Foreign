-- ============================================
-- ADD MAX PAYOUT LIMIT CONFIG COLUMN
-- ============================================
-- This decouples instant play prize selection from SYSTEM_TREASURY balance
-- Admins can now set a fixed risk cap per play (e.g., 2000)
-- The system treasury continues to track actual profit/loss

ALTER TABLE platform_config 
ADD COLUMN IF NOT EXISTS instant_max_payout_limit DECIMAL(12,2) DEFAULT 5000;

-- Add a comment explaining this column
COMMENT ON COLUMN platform_config.instant_max_payout_limit IS 'Maximum prize amount that can be awarded in a single instant play. Set to 5000 for full range, or lower to limit risk.';

-- ============================================
-- UPDATE atomic_play_instant FUNCTION
-- ============================================
-- Change from using SYSTEM_TREASURY balance to using config limit

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
  -- STEP 3: Get max payout limit from config (NOT treasury balance)
  -- This allows admin to control risk independently of actual balance
  -- =====================================================
  SELECT COALESCE(instant_max_payout_limit, 5000) INTO v_max_payout_limit
  FROM public.platform_config WHERE id = 1;
  
  -- =====================================================
  -- STEP 4: Pick an available outcome (with config limit filter)
  -- The system can ONLY pick outcomes up to the configured max
  -- =====================================================
  SELECT * INTO v_outcome
  FROM public.instant_game_pool
  WHERE status = 'available'
    AND payout_amount <= v_max_payout_limit
  ORDER BY RANDOM()
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
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
    -- Credit to earnings for wins, credits for refunds
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
  -- RETURN RESULT
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
    'max_payout_limit', v_max_payout_limit
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Instant play failed: %', SQLERRM;
END;
$function$;