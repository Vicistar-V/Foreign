-- =====================================================
-- VIKETA 2.0: INSTANT SOLO MODE DATABASE SETUP
-- The "Card Deck" System - Pre-generated outcomes for guaranteed profit
-- =====================================================

-- 1. CREATE instant_game_pool TABLE (The "Deck of Cards")
-- Pre-generated outcomes that get consumed one by one
CREATE TABLE public.instant_game_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id INTEGER NOT NULL,
  outcome_type TEXT NOT NULL CHECK (outcome_type IN ('jackpot', 'big_win', 'standard_win', 'refund', 'loss')),
  payout_amount DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'used')),
  used_by UUID REFERENCES public.profiles(id),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast lookup
CREATE INDEX idx_instant_pool_status ON public.instant_game_pool(status) WHERE status = 'available';
CREATE INDEX idx_instant_pool_batch ON public.instant_game_pool(batch_id);
CREATE INDEX idx_instant_pool_payout ON public.instant_game_pool(payout_amount) WHERE status = 'available';

-- Enable RLS
ALTER TABLE public.instant_game_pool ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only service role can manage pool, users can see their used outcomes
CREATE POLICY "Service role can manage instant pool" 
  ON public.instant_game_pool FOR ALL 
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own used outcomes" 
  ON public.instant_game_pool FOR SELECT 
  USING (used_by = auth.uid());

-- 2. CREATE instant_play_history TABLE (User's play history)
CREATE TABLE public.instant_play_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  outcome_id UUID NOT NULL REFERENCES public.instant_game_pool(id),
  outcome_type TEXT NOT NULL,
  payout_amount DECIMAL(12,2) NOT NULL,
  entry_fee DECIMAL(12,2) NOT NULL,
  net_result DECIMAL(12,2) NOT NULL,
  played_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast user history lookup
CREATE INDEX idx_instant_history_user ON public.instant_play_history(user_id, played_at DESC);

-- Enable RLS
ALTER TABLE public.instant_play_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own play history" 
  ON public.instant_play_history FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage play history" 
  ON public.instant_play_history FOR ALL 
  USING (auth.role() = 'service_role');

-- 3. ADD platform_config COLUMNS for Instant Mode
ALTER TABLE public.platform_config 
  ADD COLUMN IF NOT EXISTS instant_mode_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS instant_entry_fee DECIMAL(12,2) DEFAULT 200,
  ADD COLUMN IF NOT EXISTS instant_pool_restock_threshold INTEGER DEFAULT 200;

-- 4. CREATE seed_instant_pool FUNCTION
-- Generates a batch of 2,000 outcomes with 20% profit margin
CREATE OR REPLACE FUNCTION public.seed_instant_pool(_batch_id INTEGER DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_batch_id INTEGER;
  v_inserted INTEGER := 0;
  v_outcome_type TEXT;
  v_payout DECIMAL;
  i INTEGER;
BEGIN
  -- Get next batch ID if not provided
  IF _batch_id IS NULL THEN
    SELECT COALESCE(MAX(batch_id), 0) + 1 INTO v_batch_id FROM instant_game_pool;
  ELSE
    v_batch_id := _batch_id;
  END IF;

  -- Distribution for 2,000 tickets (20% profit margin = ₦80,000 profit per batch)
  -- Total Revenue: 2,000 × ₦200 = ₦400,000
  -- Total Payout: ₦320,000
  -- Locked Profit: ₦80,000
  
  -- 10 Jackpots @ ₦5,000 = ₦50,000
  FOR i IN 1..10 LOOP
    INSERT INTO instant_game_pool (batch_id, outcome_type, payout_amount, status)
    VALUES (v_batch_id, 'jackpot', 5000, 'available');
    v_inserted := v_inserted + 1;
  END LOOP;
  
  -- 30 Big Wins @ ₦2,000 = ₦60,000
  FOR i IN 1..30 LOOP
    INSERT INTO instant_game_pool (batch_id, outcome_type, payout_amount, status)
    VALUES (v_batch_id, 'big_win', 2000, 'available');
    v_inserted := v_inserted + 1;
  END LOOP;
  
  -- 140 Standard Wins @ ₦500 = ₦70,000
  FOR i IN 1..140 LOOP
    INSERT INTO instant_game_pool (batch_id, outcome_type, payout_amount, status)
    VALUES (v_batch_id, 'standard_win', 500, 'available');
    v_inserted := v_inserted + 1;
  END LOOP;
  
  -- 700 Refunds @ ₦200 = ₦140,000
  FOR i IN 1..700 LOOP
    INSERT INTO instant_game_pool (batch_id, outcome_type, payout_amount, status)
    VALUES (v_batch_id, 'refund', 200, 'available');
    v_inserted := v_inserted + 1;
  END LOOP;
  
  -- 1,120 Losses @ ₦0 = ₦0
  FOR i IN 1..1120 LOOP
    INSERT INTO instant_game_pool (batch_id, outcome_type, payout_amount, status)
    VALUES (v_batch_id, 'loss', 0, 'available');
    v_inserted := v_inserted + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'batch_id', v_batch_id,
    'tickets_created', v_inserted,
    'expected_revenue', 400000,
    'expected_payout', 320000,
    'expected_profit', 80000
  );
END;
$$;

-- 5. CREATE atomic_play_instant FUNCTION
-- Single atomic operation for instant play
CREATE OR REPLACE FUNCTION public.atomic_play_instant(
  _user_id UUID,
  _entry_fee DECIMAL DEFAULT 200
)
RETURNS json
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
  v_system_balance DECIMAL;
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
  -- STEP 3: Get SYSTEM_TREASURY balance for liquidity check
  -- =====================================================
  SELECT COALESCE(earnings_balance, 0) INTO v_system_balance
  FROM public.user_balances
  WHERE user_id = '00000000-0000-0000-0000-000000000000';
  
  -- =====================================================
  -- STEP 4: Pick an available outcome (with liquidity filter)
  -- The system can ONLY pick outcomes it can afford to pay
  -- =====================================================
  SELECT * INTO v_outcome
  FROM public.instant_game_pool
  WHERE status = 'available'
    AND payout_amount <= v_system_balance + _entry_fee
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
      RAISE EXCEPTION 'System cannot afford any available prizes. Please try again later.';
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
    'needs_restock', v_available_count < 200
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Instant play failed: %', SQLERRM;
END;
$$;

-- 6. CREATE get_instant_pool_stats FUNCTION
-- For checking pool status
CREATE OR REPLACE FUNCTION public.get_instant_pool_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'available_count', (SELECT COUNT(*) FROM instant_game_pool WHERE status = 'available'),
    'used_count', (SELECT COUNT(*) FROM instant_game_pool WHERE status = 'used'),
    'current_batch', (SELECT MAX(batch_id) FROM instant_game_pool),
    'jackpots_remaining', (SELECT COUNT(*) FROM instant_game_pool WHERE status = 'available' AND outcome_type = 'jackpot'),
    'big_wins_remaining', (SELECT COUNT(*) FROM instant_game_pool WHERE status = 'available' AND outcome_type = 'big_win'),
    'standard_wins_remaining', (SELECT COUNT(*) FROM instant_game_pool WHERE status = 'available' AND outcome_type = 'standard_win'),
    'refunds_remaining', (SELECT COUNT(*) FROM instant_game_pool WHERE status = 'available' AND outcome_type = 'refund'),
    'losses_remaining', (SELECT COUNT(*) FROM instant_game_pool WHERE status = 'available' AND outcome_type = 'loss')
  );
$$;

-- 7. SEED INITIAL POOL (Batch 1)
SELECT seed_instant_pool(1);

-- 8. Enable instant mode in platform config
UPDATE public.platform_config SET instant_mode_enabled = true WHERE id = 1;