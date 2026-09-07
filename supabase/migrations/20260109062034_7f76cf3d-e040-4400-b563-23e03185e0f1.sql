-- =====================================================
-- MIGRATION: "500 + Infinity 20" Referral System
-- Target: ₦2,000 | First cycle: ₦400 profit + ₦500 bonus | Subsequent: ₦900 profit + ₦20 royalty
-- =====================================================

-- STEP 1: Add new transaction type
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'referral_first_cycle_bonus';

-- STEP 2: Add new column to platform_config for subsequent cycle profit
ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS drop_profit_amount_subsequent NUMERIC DEFAULT 900;

-- STEP 3: Add first_cycle_completed_at to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_cycle_completed_at TIMESTAMPTZ;

-- STEP 4: Create pending_referral_bonuses table
CREATE TABLE IF NOT EXISTS pending_referral_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  referee_id UUID NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 500,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  UNIQUE(referrer_id, referee_id)
);

-- STEP 5: Enable RLS on pending_referral_bonuses
ALTER TABLE pending_referral_bonuses ENABLE ROW LEVEL SECURITY;

-- STEP 6: Create RLS policies for pending_referral_bonuses
CREATE POLICY "Users can view their pending bonuses as referrer"
  ON pending_referral_bonuses FOR SELECT
  USING (auth.uid() = referrer_id);

CREATE POLICY "Users can view their pending bonuses as referee"
  ON pending_referral_bonuses FOR SELECT
  USING (auth.uid() = referee_id);

CREATE POLICY "Service role can manage all pending bonuses"
  ON pending_referral_bonuses FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- UTILITY FUNCTION 1: create_pending_referral_bonus
-- Called when a new member activates (has a referrer)
-- =====================================================
CREATE OR REPLACE FUNCTION create_pending_referral_bonus(
  _referee_id UUID,
  _referred_by_code TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_referrer_id UUID;
  v_bonus_amount NUMERIC;
  v_referrer_name TEXT;
  v_referee_name TEXT;
BEGIN
  -- Skip if no referrer
  IF _referred_by_code IS NULL OR _referred_by_code = '' OR _referred_by_code = 'SYSTEM' THEN
    RETURN;
  END IF;
  
  -- Find the referrer
  SELECT id, full_name INTO v_referrer_id, v_referrer_name
  FROM profiles 
  WHERE referral_code = _referred_by_code;
  
  IF v_referrer_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Get bonus amount from config
  SELECT referral_cash_bonus INTO v_bonus_amount 
  FROM platform_config WHERE id = 1;
  
  IF v_bonus_amount <= 0 THEN
    RETURN;
  END IF;
  
  -- Get referee name
  SELECT full_name INTO v_referee_name FROM profiles WHERE id = _referee_id;
  
  -- Insert pending bonus (ignore if already exists)
  INSERT INTO pending_referral_bonuses (referrer_id, referee_id, amount, status)
  VALUES (v_referrer_id, _referee_id, v_bonus_amount, 'pending')
  ON CONFLICT (referrer_id, referee_id) DO NOTHING;
  
  -- Notify referrer about the pending bonus
  PERFORM create_notification(
    _user_id := v_referrer_id,
    _type := 'referral_bonus_pending',
    _title := format('₦%s Bonus Locked!', v_bonus_amount),
    _message := format('%s just activated! Help them complete their first cycle to unlock your ₦%s bonus.', 
      COALESCE(v_referee_name, 'Your friend'), v_bonus_amount),
    _metadata := json_build_object('referee_id', _referee_id, 'referee_name', v_referee_name)::jsonb
  );
END;
$$;

-- =====================================================
-- UTILITY FUNCTION 2: pay_first_cycle_referral_bonus
-- Called when referee completes their first cycle
-- =====================================================
CREATE OR REPLACE FUNCTION pay_first_cycle_referral_bonus(
  _referee_id UUID,
  _referred_by_code TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_referrer_id UUID;
  v_pending_bonus RECORD;
  v_referee_name TEXT;
BEGIN
  -- Skip if no referrer
  IF _referred_by_code IS NULL OR _referred_by_code = '' OR _referred_by_code = 'SYSTEM' THEN
    RETURN;
  END IF;
  
  -- Find the referrer
  SELECT id INTO v_referrer_id 
  FROM profiles 
  WHERE referral_code = _referred_by_code;
  
  IF v_referrer_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Check for pending bonus
  SELECT * INTO v_pending_bonus
  FROM pending_referral_bonuses
  WHERE referee_id = _referee_id 
    AND referrer_id = v_referrer_id
    AND status = 'pending';
  
  IF v_pending_bonus IS NULL THEN
    RETURN;
  END IF;
  
  -- Get referee name
  SELECT full_name INTO v_referee_name FROM profiles WHERE id = _referee_id;
  
  -- Pay the referrer their ₦500 bonus
  INSERT INTO transactions (
    user_id, amount, transaction_type, wallet_type, description, status, metadata
  ) VALUES (
    v_referrer_id,
    v_pending_bonus.amount,
    'referral_first_cycle_bonus',
    'earnings',
    format('₦%s bonus - %s completed first cycle!', v_pending_bonus.amount, COALESCE(v_referee_name, 'Your recruit')),
    'completed',
    json_build_object('referee_id', _referee_id, 'referee_name', v_referee_name, 'bonus_type', 'first_cycle')
  );
  
  -- Mark pending bonus as paid
  UPDATE pending_referral_bonuses
  SET status = 'paid', paid_at = now()
  WHERE id = v_pending_bonus.id;
  
  -- Notify referrer
  PERFORM create_notification(
    _user_id := v_referrer_id,
    _type := 'referral_bonus_paid',
    _title := format('₦%s Bonus Unlocked!', v_pending_bonus.amount),
    _message := format('%s completed their first cycle! Your ₦%s bonus is now in your wallet.', 
      COALESCE(v_referee_name, 'Your recruit'), v_pending_bonus.amount),
    _metadata := json_build_object('referee_id', _referee_id, 'bonus_amount', v_pending_bonus.amount)::jsonb
  );
  
  -- Invalidate cached balance
  DELETE FROM cached_balances WHERE user_id = v_referrer_id;
END;
$$;

-- =====================================================
-- UTILITY FUNCTION 3: get_user_profit_amount (NEW)
-- Returns correct profit based on first/subsequent cycle
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_profit_amount(
  _user_id UUID
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_first_cycle_at TIMESTAMPTZ;
  v_config RECORD;
BEGIN
  -- Get first cycle status
  SELECT first_cycle_completed_at INTO v_first_cycle_at
  FROM profiles WHERE id = _user_id;
  
  -- Get config
  SELECT drop_profit_amount, drop_profit_amount_subsequent INTO v_config
  FROM platform_config WHERE id = 1;
  
  -- Return appropriate amount
  IF v_first_cycle_at IS NULL THEN
    RETURN v_config.drop_profit_amount; -- ₦400 for first cycle
  ELSE
    RETURN v_config.drop_profit_amount_subsequent; -- ₦900 for subsequent
  END IF;
END;
$$;

-- =====================================================
-- UTILITY FUNCTION 4: mark_first_cycle_done (NEW)
-- Marks first cycle complete and triggers ₦500 bonus
-- =====================================================
CREATE OR REPLACE FUNCTION mark_first_cycle_done(
  _user_id UUID,
  _referred_by_code TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Mark first cycle complete
  UPDATE profiles 
  SET first_cycle_completed_at = now() 
  WHERE id = _user_id;
  
  -- Pay the ₦500 referral bonus (if they have a referrer)
  IF _referred_by_code IS NOT NULL AND _referred_by_code != '' AND _referred_by_code != 'SYSTEM' THEN
    PERFORM pay_first_cycle_referral_bonus(_user_id, _referred_by_code);
  END IF;
END;
$$;

-- =====================================================
-- UTILITY FUNCTION 5: pay_genesis_yield (NEW)
-- Handles genesis mode payouts to deposit wallet
-- =====================================================
CREATE OR REPLACE FUNCTION pay_genesis_yield(
  _user_id UUID,
  _spot_id UUID,
  _amount NUMERIC,
  _is_first_cycle BOOLEAN
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_spot RECORD;
  v_config RECORD;
  v_deposit_balance NUMERIC;
  v_leftover NUMERIC;
  v_spot_result JSON;
BEGIN
  -- Get spot data
  SELECT genesis_yields_remaining INTO v_spot
  FROM spots WHERE id = _spot_id;
  
  -- Get config
  SELECT drop_entry_fee INTO v_config FROM platform_config WHERE id = 1;
  
  -- Pay to DEPOSIT wallet (locked for genesis)
  INSERT INTO transactions (
    user_id, amount, transaction_type, wallet_type, description, status, metadata
  ) VALUES (
    _user_id,
    _amount,
    'genesis_yield',
    'deposit',
    format('Genesis cycle %s/3 - Building your second machine...', 4 - v_spot.genesis_yields_remaining),
    'completed',
    json_build_object(
      'genesis_cycle', 4 - v_spot.genesis_yields_remaining, 
      'spot_id', _spot_id,
      'is_first_cycle', _is_first_cycle
    )
  );
  
  -- Decrement genesis counter
  UPDATE spots 
  SET genesis_yields_remaining = genesis_yields_remaining - 1
  WHERE id = _spot_id;
  
  -- Check if this was the 3rd cycle (counter was 1, now becomes 0)
  IF v_spot.genesis_yields_remaining = 1 THEN
    
    -- Get deposit balance AFTER this transaction
    SELECT check_balance(_user_id, 'deposit') INTO v_deposit_balance;
    
    -- Should have enough for a new machine
    IF v_deposit_balance >= v_config.drop_entry_fee THEN
      
      -- Auto-buy Machine 2 from deposit wallet!
      SELECT create_spot(_user_id, 'deposit') INTO v_spot_result;
      
      IF (v_spot_result->>'success')::boolean THEN
        -- Move leftover to earnings
        SELECT check_balance(_user_id, 'deposit') INTO v_leftover;
        
        IF v_leftover > 0 THEN
          -- Transfer out of deposit
          INSERT INTO transactions (
            user_id, amount, transaction_type, wallet_type, description, status, metadata
          ) VALUES (
            _user_id, 
            -v_leftover, 
            'genesis_transfer', 
            'deposit', 
            'Genesis complete - transferring bonus',
            'completed',
            json_build_object('transfer_type', 'genesis_leftover')
          );
          
          -- Transfer into earnings
          INSERT INTO transactions (
            user_id, amount, transaction_type, wallet_type, description, status, metadata
          ) VALUES (
            _user_id, 
            v_leftover, 
            'genesis_transfer', 
            'earnings', 
            format('Genesis bonus! ₦%s ready to withdraw!', v_leftover),
            'completed',
            json_build_object('transfer_type', 'genesis_bonus')
          );
        END IF;
        
        -- Mark genesis complete on profile
        UPDATE profiles 
        SET genesis_completed_at = now() 
        WHERE id = _user_id;
        
        -- Celebrate with notification!
        PERFORM create_notification(
          _user_id := _user_id,
          _type := 'genesis_complete',
          _title := 'GENESIS COMPLETE! You now own 2 machines!',
          _message := format('Your first 3 payouts built you %s. Welcome to the Viketa Empire! You also got ₦%s bonus to withdraw.', 
            v_spot_result->>'spot_name', COALESCE(v_leftover, 0))
        );
      END IF;
    END IF;
  ELSE
    -- Not the 3rd cycle yet, just notify progress
    PERFORM create_notification(
      _user_id := _user_id,
      _type := 'genesis_progress',
      _title := format('Genesis Cycle %s/3 Complete!', 4 - v_spot.genesis_yields_remaining + 1),
      _message := format('₦%s added to your genesis fund. %s more cycle(s) until your second machine is built!', 
        _amount, v_spot.genesis_yields_remaining - 1)
    );
  END IF;
  
  -- Invalidate cache
  DELETE FROM cached_balances WHERE user_id = _user_id;
END;
$$;

-- =====================================================
-- UTILITY FUNCTION 6: try_auto_buy_machine (NEW)
-- Checks earnings and auto-buys if enough balance
-- =====================================================
CREATE OR REPLACE FUNCTION try_auto_buy_machine(
  _user_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_earnings_balance NUMERIC;
  v_entry_fee NUMERIC;
  v_spot_result JSON;
BEGIN
  -- Get entry fee from config
  SELECT drop_entry_fee INTO v_entry_fee FROM platform_config WHERE id = 1;
  
  -- Check earnings balance
  SELECT check_balance(_user_id, 'earnings') INTO v_earnings_balance;
  
  IF v_earnings_balance >= v_entry_fee THEN
    -- AUTO-BUY: Create a new spot using earnings wallet
    SELECT create_spot(_user_id, 'earnings') INTO v_spot_result;
    
    -- Notify user about auto-purchase
    IF (v_spot_result->>'success')::boolean THEN
      PERFORM create_notification(
        _user_id := _user_id,
        _type := 'auto_compound_purchase',
        _title := 'Empire Builder bought you a new machine!',
        _message := format('Your profits added up to ₦%s, so we automatically bought %s for you!', 
          v_entry_fee, v_spot_result->>'spot_name')
      );
    END IF;
  END IF;
END;
$$;

-- =====================================================
-- UPDATE: pay_admin_fee (add _has_referrer parameter)
-- Pays ₦80 if referrer exists, ₦100 otherwise
-- =====================================================
CREATE OR REPLACE FUNCTION pay_admin_fee(
  _drop_id UUID,
  _from_user_id UUID,
  _admin_fee NUMERIC,
  _has_referrer BOOLEAN DEFAULT false
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_from_user_name TEXT;
  v_actual_fee NUMERIC;
  v_referral_per_cycle NUMERIC;
BEGIN
  IF _admin_fee <= 0 THEN
    RETURN;
  END IF;
  
  -- Get referral amount from config
  SELECT drop_referral_per_cycle INTO v_referral_per_cycle FROM platform_config WHERE id = 1;
  
  -- Calculate actual admin fee (reduced if referrer exists on subsequent cycles)
  IF _has_referrer AND v_referral_per_cycle > 0 THEN
    v_actual_fee := _admin_fee - v_referral_per_cycle; -- ₦100 - ₦20 = ₦80
  ELSE
    v_actual_fee := _admin_fee; -- Full ₦100
  END IF;
  
  -- Get user's name for metadata
  SELECT full_name INTO v_from_user_name FROM profiles WHERE id = _from_user_id;
  
  -- Pay admin fee to SYSTEM_TREASURY
  INSERT INTO transactions (
    user_id, amount, transaction_type, wallet_type, description, status, metadata
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_actual_fee,
    'platform_fee',
    'earnings',
    'Machine yield fee',
    'completed',
    json_build_object(
      'drop_id', _drop_id,
      'admin_fee', v_actual_fee,
      'original_fee', _admin_fee,
      'from_user', _from_user_id,
      'from_user_name', v_from_user_name,
      'had_referrer', _has_referrer
    )
  );
END;
$$;

-- =====================================================
-- UPDATE: pay_user_profit (REFACTORED - Clean Orchestrator)
-- Uses utility functions for clean separation
-- =====================================================
CREATE OR REPLACE FUNCTION public.pay_user_profit(
  _user_id UUID, 
  _spot_id UUID, 
  _profit_amount NUMERIC,
  _auto_compound BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_spot RECORD;
  v_profile RECORD;
  v_actual_profit NUMERIC;
  v_is_first_cycle BOOLEAN;
BEGIN
  -- Get spot genesis status
  SELECT is_genesis_spot, genesis_yields_remaining
  INTO v_spot
  FROM spots WHERE id = _spot_id;

  -- Get profile data
  SELECT first_cycle_completed_at, referred_by_code
  INTO v_profile
  FROM profiles WHERE id = _user_id;
  
  -- Step 1: Determine if first cycle
  v_is_first_cycle := (v_profile.first_cycle_completed_at IS NULL);
  
  -- Step 2: Get correct profit amount (₦400 or ₦900)
  v_actual_profit := get_user_profit_amount(_user_id);
  
  -- Step 3: Handle first cycle completion (mark + pay ₦500 bonus)
  IF v_is_first_cycle THEN
    PERFORM mark_first_cycle_done(_user_id, v_profile.referred_by_code);
  END IF;

  -- Step 4: Route to genesis or normal payout
  IF v_spot.is_genesis_spot AND v_spot.genesis_yields_remaining > 0 THEN
    -- Genesis mode: pay to deposit wallet
    PERFORM pay_genesis_yield(_user_id, _spot_id, v_actual_profit, v_is_first_cycle);
    RETURN; -- Genesis handled everything
  END IF;

  -- Step 5: Normal payout to earnings wallet
  INSERT INTO transactions (
    user_id, amount, transaction_type, wallet_type, description, status, metadata
  ) VALUES (
    _user_id,
    v_actual_profit,
    'drop_profit',
    'earnings',
    CASE 
      WHEN v_is_first_cycle THEN 'First cycle payout - Welcome to Viketa!'
      WHEN _auto_compound THEN 'Machine payout - Empire Builder active'
      ELSE 'Machine payout - Ready to withdraw!'
    END,
    'completed',
    json_build_object(
      'auto_compounded', _auto_compound,
      'is_first_cycle', v_is_first_cycle,
      'profit_amount', v_actual_profit
    )
  );
  
  -- Step 6: Try auto-compound if enabled
  IF _auto_compound THEN
    PERFORM try_auto_buy_machine(_user_id);
  END IF;
  
  -- Invalidate cache
  DELETE FROM cached_balances WHERE user_id = _user_id;
END;
$$;

-- =====================================================
-- UPDATE: distribute_liquidity
-- Skip ₦20 royalty on first cycle, reduce admin fee for subsequent
-- =====================================================
CREATE OR REPLACE FUNCTION public.distribute_liquidity(
  _origin_drop_id UUID, 
  _amount NUMERIC, 
  _max_depth INTEGER DEFAULT 100
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_remaining NUMERIC := _amount;
  v_distributed NUMERIC := 0;
  v_payouts_made INTEGER := 0;
  v_reentries_made INTEGER := 0;
  v_depth INTEGER := 0;
  v_target_drop RECORD;
  v_config RECORD;
  v_amount_to_fill NUMERIC;
  v_overflow NUMERIC;
  v_spot_owner_id UUID;
  v_should_auto_compound BOOLEAN;
  v_is_first_cycle BOOLEAN;
  v_has_referrer BOOLEAN;
  v_actual_profit NUMERIC;
BEGIN
  -- Get platform config
  SELECT * INTO v_config FROM platform_config WHERE id = 1;
  
  -- Process liquidity distribution
  WHILE v_remaining > 0 AND v_depth < _max_depth LOOP
    v_depth := v_depth + 1;
    
    -- Find the oldest unfilled drop (excluding the origin)
    SELECT d.*, s.id as spot_id, s.user_id as spot_owner_id,
           p.auto_compound_enabled, p.referred_by_code, p.first_cycle_completed_at
    INTO v_target_drop
    FROM drops d
    JOIN spots s ON s.id = d.spot_id
    JOIN profiles p ON p.id = s.user_id
    WHERE d.id != _origin_drop_id
      AND d.status IN ('waiting', 'filling')
      AND d.fill_amount < d.target_amount
    ORDER BY d.position ASC
    LIMIT 1;
    
    -- No more drops to fill
    IF v_target_drop IS NULL THEN
      EXIT;
    END IF;
    
    -- Calculate how much this drop needs
    v_amount_to_fill := LEAST(v_remaining, v_target_drop.target_amount - v_target_drop.fill_amount);
    
    -- Update the drop's fill amount
    UPDATE drops 
    SET fill_amount = fill_amount + v_amount_to_fill,
        status = CASE 
          WHEN fill_amount + v_amount_to_fill >= target_amount THEN 'completed'
          ELSE 'filling'
        END,
        completed_at = CASE 
          WHEN fill_amount + v_amount_to_fill >= target_amount THEN now()
          ELSE NULL
        END
    WHERE id = v_target_drop.id;
    
    v_remaining := v_remaining - v_amount_to_fill;
    v_distributed := v_distributed + v_amount_to_fill;
    
    -- Check if this drop is now complete (bucket full at target amount)
    IF v_target_drop.fill_amount + v_amount_to_fill >= v_target_drop.target_amount THEN
      v_payouts_made := v_payouts_made + 1;
      v_spot_owner_id := v_target_drop.spot_owner_id;
      v_should_auto_compound := COALESCE(v_target_drop.auto_compound_enabled, false);
      
      -- Determine if this is user's first cycle (BEFORE pay_user_profit updates it)
      v_is_first_cycle := (v_target_drop.first_cycle_completed_at IS NULL);
      
      -- Check if user has a referrer
      v_has_referrer := (
        v_target_drop.referred_by_code IS NOT NULL AND 
        v_target_drop.referred_by_code != '' AND 
        v_target_drop.referred_by_code != 'SYSTEM'
      );
      
      -- Calculate actual profit for stats (₦400 first, ₦900 subsequent)
      IF v_is_first_cycle THEN
        v_actual_profit := v_config.drop_profit_amount;
      ELSE
        v_actual_profit := v_config.drop_profit_amount_subsequent;
      END IF;
      
      -- ==========================================
      -- STEP 1: Pay referral bonus (ONLY for subsequent cycles!)
      -- First cycle: ₦500 bonus handled inside pay_user_profit
      -- Subsequent: ₦20 royalty (paid from platform fee)
      -- ==========================================
      IF NOT v_is_first_cycle AND v_has_referrer THEN
        PERFORM pay_referral_bonus(
          v_target_drop.referred_by_code,
          v_spot_owner_id,
          v_config.drop_referral_per_cycle
        );
      END IF;
      
      -- ==========================================
      -- STEP 2: Pay user profit
      -- First cycle: ₦400 (also triggers ₦500 referral bonus)
      -- Subsequent: ₦900
      -- ==========================================
      PERFORM pay_user_profit(
        v_spot_owner_id,
        v_target_drop.spot_id,
        v_config.drop_profit_amount,
        v_should_auto_compound
      );
      
      -- ==========================================
      -- STEP 3: Pay admin fee
      -- With referrer (subsequent): ₦80 (reduced by ₦20)
      -- Without referrer OR first cycle: ₦100 (full)
      -- ==========================================
      PERFORM pay_admin_fee(
        v_target_drop.id,
        v_spot_owner_id,
        v_config.drop_admin_fee,
        (NOT v_is_first_cycle AND v_has_referrer)
      );
      
      -- ==========================================
      -- STEP 4: Update spot statistics
      -- ==========================================
      PERFORM update_spot_stats(
        v_target_drop.spot_id,
        v_actual_profit
      );
      
      -- Mark drop as paid
      UPDATE drops 
      SET status = 'paid', paid_at = now()
      WHERE id = v_target_drop.id;
      
      -- ==========================================
      -- STEP 5: Send notification (skip if genesis handled it)
      -- ==========================================
      IF NOT (SELECT is_genesis_spot AND genesis_yields_remaining >= 0 FROM spots WHERE id = v_target_drop.spot_id) THEN
        PERFORM send_payout_notification(
          v_spot_owner_id,
          v_actual_profit,
          v_should_auto_compound
        );
      END IF;
      
      -- ==========================================
      -- STEP 6: Create re-entry drop
      -- ==========================================
      PERFORM create_reentry_drop(v_target_drop.spot_id);
      v_reentries_made := v_reentries_made + 1;
      
      -- Calculate overflow
      v_overflow := (v_target_drop.fill_amount + v_amount_to_fill) - v_target_drop.target_amount;
      IF v_overflow > 0 THEN
        v_remaining := v_remaining + v_overflow;
      END IF;
    END IF;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'distributed', v_distributed,
    'payouts_made', v_payouts_made,
    'reentries_made', v_reentries_made,
    'remaining', v_remaining,
    'depth', v_depth
  );
END;
$$;

-- =====================================================
-- STEP FINAL: Update platform_config values
-- =====================================================
UPDATE platform_config SET
  drop_target_amount = 2000,
  referral_cash_bonus = 500,
  drop_profit_amount = 400,
  drop_profit_amount_subsequent = 900,
  drop_referral_per_cycle = 20
WHERE id = 1;