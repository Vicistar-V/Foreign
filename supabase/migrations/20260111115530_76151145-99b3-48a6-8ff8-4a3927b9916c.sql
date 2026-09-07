-- =====================================================
-- VELOCITY TIER SYSTEM MIGRATION
-- "Passenger" (0-1 referrals) vs "Verified Boss" (2+ referrals)
-- =====================================================

-- =====================================================
-- STEP 1: Add velocity tier columns to profiles
-- =====================================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_payout_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS total_recycled_profit NUMERIC DEFAULT 0;

-- =====================================================
-- STEP 2: Add velocity tier config to platform_config
-- =====================================================
ALTER TABLE public.platform_config 
ADD COLUMN IF NOT EXISTS velocity_tier_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS velocity_tier_referral_requirement INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS velocity_tier_cooldown_hours INTEGER DEFAULT 24;

-- =====================================================
-- STEP 3: Helper function to get user's velocity tier
-- Returns 'verified' if user has >= required referrals, else 'passenger'
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_user_velocity_tier(_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_active_referrals INTEGER;
  v_required INTEGER;
  v_enabled BOOLEAN;
BEGIN
  -- Get config
  SELECT 
    velocity_tier_enabled,
    velocity_tier_referral_requirement 
  INTO v_enabled, v_required
  FROM platform_config WHERE id = 1;
  
  -- If velocity tier system is disabled, everyone is "verified"
  IF NOT COALESCE(v_enabled, true) THEN
    RETURN 'verified';
  END IF;
  
  -- Count active referrals (people who joined using this user's code AND are members)
  SELECT COUNT(*) INTO v_active_referrals
  FROM profiles p
  WHERE p.referred_by_code = (SELECT referral_code FROM profiles WHERE id = _user_id)
    AND p.is_member = true;
  
  -- Return tier
  IF v_active_referrals >= COALESCE(v_required, 2) THEN
    RETURN 'verified';
  ELSE
    RETURN 'passenger';
  END IF;
END;
$$;

-- =====================================================
-- STEP 4: Helper function to check if user can receive payout
-- Verified users: always can
-- Passenger users: only if 24 hours passed since last payout
-- =====================================================
CREATE OR REPLACE FUNCTION public.can_user_receive_payout(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tier TEXT;
  v_last_payout TIMESTAMPTZ;
  v_cooldown INTEGER;
  v_enabled BOOLEAN;
BEGIN
  -- Get config
  SELECT 
    velocity_tier_enabled,
    velocity_tier_cooldown_hours 
  INTO v_enabled, v_cooldown
  FROM platform_config WHERE id = 1;
  
  -- If velocity tier system is disabled, everyone can receive payout
  IF NOT COALESCE(v_enabled, true) THEN
    RETURN true;
  END IF;
  
  -- Get user's tier
  v_tier := get_user_velocity_tier(_user_id);
  
  -- Verified users always can receive payout
  IF v_tier = 'verified' THEN
    RETURN true;
  END IF;
  
  -- Get last payout time
  SELECT last_payout_at INTO v_last_payout 
  FROM profiles WHERE id = _user_id;
  
  -- First payout ever? Allow it
  IF v_last_payout IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check if cooldown hours have passed
  RETURN v_last_payout < NOW() - (COALESCE(v_cooldown, 24) || ' hours')::INTERVAL;
END;
$$;

-- =====================================================
-- STEP 5: Helper function to get velocity tier details
-- Returns JSON with all relevant info for frontend
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_velocity_tier_details(_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tier TEXT;
  v_can_receive BOOLEAN;
  v_last_payout TIMESTAMPTZ;
  v_total_recycled NUMERIC;
  v_cooldown_hours INTEGER;
  v_next_payout_at TIMESTAMPTZ;
  v_active_referrals INTEGER;
  v_required INTEGER;
  v_enabled BOOLEAN;
BEGIN
  -- Get config
  SELECT 
    velocity_tier_enabled,
    velocity_tier_referral_requirement,
    velocity_tier_cooldown_hours 
  INTO v_enabled, v_required, v_cooldown_hours
  FROM platform_config WHERE id = 1;
  
  -- Get user data
  SELECT 
    last_payout_at,
    total_recycled_profit
  INTO v_last_payout, v_total_recycled
  FROM profiles WHERE id = _user_id;
  
  -- Count active referrals
  SELECT COUNT(*) INTO v_active_referrals
  FROM profiles p
  WHERE p.referred_by_code = (SELECT referral_code FROM profiles WHERE id = _user_id)
    AND p.is_member = true;
  
  -- Get tier and payout status
  v_tier := get_user_velocity_tier(_user_id);
  v_can_receive := can_user_receive_payout(_user_id);
  
  -- Calculate next payout time for passengers
  IF v_tier = 'passenger' AND v_last_payout IS NOT NULL THEN
    v_next_payout_at := v_last_payout + (v_cooldown_hours || ' hours')::INTERVAL;
  END IF;
  
  RETURN json_build_object(
    'enabled', COALESCE(v_enabled, true),
    'tier', v_tier,
    'can_receive_payout', v_can_receive,
    'last_payout_at', v_last_payout,
    'next_payout_at', v_next_payout_at,
    'total_recycled_profit', COALESCE(v_total_recycled, 0),
    'active_referrals', v_active_referrals,
    'referrals_needed', GREATEST(0, COALESCE(v_required, 2) - v_active_referrals),
    'referral_requirement', COALESCE(v_required, 2),
    'cooldown_hours', COALESCE(v_cooldown_hours, 24)
  );
END;
$$;

-- =====================================================
-- STEP 6: Notification function for overflow
-- =====================================================
CREATE OR REPLACE FUNCTION public.send_overflow_notification(
  _user_id UUID, 
  _recycled_amount NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM create_notification(
    _user_id,
    'Profit Powered the Queue!',
    'Your ₦' || _recycled_amount::TEXT || ' profit helped speed up the queue. Invite 2 friends to unlock UNLIMITED payouts!',
    'velocity_overflow',
    NULL,
    NULL
  );
END;
$$;

-- =====================================================
-- STEP 7: UPDATE distribute_liquidity for velocity tiers
-- Now checks if user can receive payout before paying
-- If not, profit is recycled back into the queue
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
  v_recycled_count INTEGER := 0;
  v_total_recycled NUMERIC := 0;
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
  v_can_receive_payout BOOLEAN;
  v_user_tier TEXT;
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
      -- VELOCITY TIER CHECK: Can user receive payout?
      -- ==========================================
      v_can_receive_payout := can_user_receive_payout(v_spot_owner_id);
      v_user_tier := get_user_velocity_tier(v_spot_owner_id);
      
      IF v_can_receive_payout THEN
        -- ==========================================
        -- NORMAL FLOW: User CAN receive payout
        -- ==========================================
        v_payouts_made := v_payouts_made + 1;
        
        -- STEP 1: Pay referral bonus (ONLY for subsequent cycles!)
        IF NOT v_is_first_cycle AND v_has_referrer THEN
          PERFORM pay_referral_bonus(
            v_target_drop.referred_by_code,
            v_spot_owner_id,
            v_config.drop_referral_per_cycle
          );
        END IF;
        
        -- STEP 2: Pay user profit
        PERFORM pay_user_profit(
          v_spot_owner_id,
          v_target_drop.spot_id,
          v_config.drop_profit_amount,
          v_should_auto_compound
        );
        
        -- STEP 3: Update last_payout_at for velocity tier tracking
        UPDATE profiles 
        SET last_payout_at = NOW() 
        WHERE id = v_spot_owner_id;
        
        -- STEP 4: Pay admin fee
        PERFORM pay_admin_fee(
          v_target_drop.id,
          v_spot_owner_id,
          v_config.drop_admin_fee,
          (NOT v_is_first_cycle AND v_has_referrer)
        );
        
        -- STEP 5: Update spot statistics
        PERFORM update_spot_stats(
          v_target_drop.spot_id,
          v_actual_profit
        );
        
        -- Mark drop as paid
        UPDATE drops 
        SET status = 'paid', paid_at = now()
        WHERE id = v_target_drop.id;
        
        -- STEP 6: Send notification (skip if genesis handled it)
        IF NOT (SELECT is_genesis_spot AND genesis_yields_remaining >= 0 FROM spots WHERE id = v_target_drop.spot_id) THEN
          PERFORM send_payout_notification(
            v_spot_owner_id,
            v_actual_profit,
            v_should_auto_compound
          );
        END IF;
      ELSE
        -- ==========================================
        -- OVERFLOW FLOW: User is PASSENGER and already got payout today
        -- Profit is recycled back into the queue
        -- ==========================================
        v_recycled_count := v_recycled_count + 1;
        v_total_recycled := v_total_recycled + v_actual_profit;
        
        -- Track recycled amount on user's profile
        UPDATE profiles 
        SET total_recycled_profit = COALESCE(total_recycled_profit, 0) + v_actual_profit 
        WHERE id = v_spot_owner_id;
        
        -- Add recycled profit back to remaining liquidity (speeds up queue!)
        v_remaining := v_remaining + v_actual_profit;
        
        -- Still pay referrer their ₦20 royalty (they earned it by inviting)
        IF NOT v_is_first_cycle AND v_has_referrer THEN
          PERFORM pay_referral_bonus(
            v_target_drop.referred_by_code,
            v_spot_owner_id,
            v_config.drop_referral_per_cycle
          );
        END IF;
        
        -- Still pay admin fee
        PERFORM pay_admin_fee(
          v_target_drop.id,
          v_spot_owner_id,
          v_config.drop_admin_fee,
          (NOT v_is_first_cycle AND v_has_referrer)
        );
        
        -- Mark drop as paid (but user didn't get the profit)
        UPDATE drops 
        SET status = 'paid', paid_at = now()
        WHERE id = v_target_drop.id;
        
        -- Send overflow notification to user
        PERFORM send_overflow_notification(v_spot_owner_id, v_actual_profit);
      END IF;
      
      -- ==========================================
      -- ALWAYS: Create re-entry drop (user keeps their position)
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
    'recycled_count', v_recycled_count,
    'total_recycled', v_total_recycled,
    'remaining', v_remaining,
    'depth', v_depth
  );
END;
$$;