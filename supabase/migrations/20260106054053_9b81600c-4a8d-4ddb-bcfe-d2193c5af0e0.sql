-- =====================================================
-- USER-AS-ASSET TRANSFORMATION: DATABASE CHANGES
-- =====================================================

-- 1. Add auto_compound_enabled column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS auto_compound_enabled BOOLEAN DEFAULT false;

-- 2. Add comment to explain the column
COMMENT ON COLUMN public.profiles.auto_compound_enabled IS 'When true, profits automatically buy new machines when earnings reach entry_fee amount';

-- =====================================================
-- FUNCTION: get_community_velocity
-- Returns velocity metrics for the Community Speed Indicator
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_community_velocity()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payouts_last_10_min INTEGER;
  v_payouts_last_hour INTEGER;
  v_avg_cycle_time_minutes NUMERIC;
  v_last_payout_at TIMESTAMPTZ;
  v_velocity_level TEXT;
  v_velocity_percent INTEGER;
BEGIN
  -- Count payouts in last 10 minutes
  SELECT COUNT(*) INTO v_payouts_last_10_min
  FROM drops
  WHERE status IN ('paid', 'pending_redrop', 're-entered')
    AND paid_at > now() - interval '10 minutes';
    
  -- Count payouts in last hour
  SELECT COUNT(*) INTO v_payouts_last_hour
  FROM drops
  WHERE status IN ('paid', 'pending_redrop', 're-entered')
    AND paid_at > now() - interval '1 hour';
    
  -- Get last payout time
  SELECT MAX(paid_at) INTO v_last_payout_at
  FROM drops
  WHERE status IN ('paid', 'pending_redrop', 're-entered');
  
  -- Calculate average cycle time (time between payouts in last hour)
  SELECT EXTRACT(EPOCH FROM (now() - COALESCE(v_last_payout_at, now()))) / 60.0
  INTO v_avg_cycle_time_minutes;
  
  -- Determine velocity level
  -- HIGH: More than 5 payouts in last 10 min
  -- MEDIUM: 2-5 payouts in last 10 min
  -- STABLE: 0-1 payouts in last 10 min
  IF v_payouts_last_10_min > 5 THEN
    v_velocity_level := 'HIGH';
    v_velocity_percent := LEAST(100, 70 + (v_payouts_last_10_min * 3));
  ELSIF v_payouts_last_10_min >= 2 THEN
    v_velocity_level := 'MEDIUM';
    v_velocity_percent := 40 + (v_payouts_last_10_min * 10);
  ELSE
    v_velocity_level := 'STABLE';
    v_velocity_percent := GREATEST(10, v_payouts_last_10_min * 20);
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'velocity_level', v_velocity_level,
    'velocity_percent', v_velocity_percent,
    'payouts_last_10_min', v_payouts_last_10_min,
    'payouts_last_hour', v_payouts_last_hour,
    'avg_cycle_time_minutes', ROUND(v_avg_cycle_time_minutes::numeric, 1),
    'last_payout_at', v_last_payout_at
  );
END;
$$;

-- =====================================================
-- MODIFY: distribute_liquidity to support auto-compound
-- When a user has auto_compound_enabled and earnings >= entry_fee,
-- automatically buy a new machine for them
-- =====================================================
CREATE OR REPLACE FUNCTION public.distribute_liquidity(
  _amount NUMERIC,
  _origin_drop_id UUID,
  _max_depth INTEGER DEFAULT 5
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config RECORD;
  v_remaining_amount NUMERIC;
  v_current_depth INTEGER := 0;
  v_drops_filled INTEGER := 0;
  v_payouts_made INTEGER := 0;
  v_total_distributed NUMERIC := 0;
  v_target_drop RECORD;
  v_amount_needed NUMERIC;
  v_amount_to_pour NUMERIC;
  v_spot RECORD;
  v_user_profile RECORD;
  v_referrer_id UUID;
  v_referrer_profile RECORD;
  v_admin_fee NUMERIC;
  v_referral_bonus NUMERIC;
  v_user_earnings NUMERIC;
  v_auto_compound_result JSON;
BEGIN
  -- Get platform config
  SELECT * INTO v_config FROM platform_config WHERE id = 1;
  
  v_remaining_amount := _amount;
  
  -- Distribution loop - fill buckets until amount exhausted or max depth reached
  WHILE v_remaining_amount > 0 AND v_current_depth < _max_depth LOOP
    v_current_depth := v_current_depth + 1;
    
    -- Find oldest unfilled drop (excluding the origin drop and any drops that belong to the same user)
    SELECT d.*, s.user_id, p.full_name, p.referred_by_code, p.auto_compound_enabled
    INTO v_target_drop
    FROM drops d
    JOIN spots s ON d.spot_id = s.id
    JOIN profiles p ON s.user_id = p.id
    WHERE d.fill_amount < d.target_amount
      AND d.status IN ('waiting', 'filling')
      AND d.id != _origin_drop_id
    ORDER BY d.position ASC
    LIMIT 1;
    
    -- No more drops to fill
    IF NOT FOUND THEN
      EXIT;
    END IF;
    
    -- Calculate how much this drop needs
    v_amount_needed := v_target_drop.target_amount - v_target_drop.fill_amount;
    v_amount_to_pour := LEAST(v_remaining_amount, v_amount_needed);
    
    -- Update the drop's fill amount
    UPDATE drops
    SET fill_amount = fill_amount + v_amount_to_pour,
        status = CASE 
          WHEN fill_amount + v_amount_to_pour >= target_amount THEN 'completed'
          ELSE 'filling'
        END,
        completed_at = CASE 
          WHEN fill_amount + v_amount_to_pour >= target_amount THEN now()
          ELSE completed_at
        END
    WHERE id = v_target_drop.id;
    
    v_remaining_amount := v_remaining_amount - v_amount_to_pour;
    v_total_distributed := v_total_distributed + v_amount_to_pour;
    v_drops_filled := v_drops_filled + 1;
    
    -- Check if this drop is now complete (hit target amount)
    IF v_target_drop.fill_amount + v_amount_to_pour >= v_target_drop.target_amount THEN
      v_payouts_made := v_payouts_made + 1;
      
      -- Mark drop as paid and spot as pending_redrop
      UPDATE drops
      SET status = 'pending_redrop',
          paid_at = now()
      WHERE id = v_target_drop.id;
      
      UPDATE spots
      SET status = 'pending_redrop',
          total_cycles = total_cycles + 1,
          total_earnings = total_earnings + v_config.drop_profit_amount
      WHERE id = v_target_drop.spot_id;
      
      -- Calculate admin fee (reduced if referrer exists)
      v_referral_bonus := 0;
      v_admin_fee := v_config.drop_admin_fee;
      
      -- Check if user has a referrer for royalty payment
      IF v_target_drop.referred_by_code IS NOT NULL THEN
        -- Find the referrer
        SELECT id, full_name INTO v_referrer_profile
        FROM profiles
        WHERE referral_code = v_target_drop.referred_by_code;
        
        IF v_referrer_profile.id IS NOT NULL AND v_config.drop_referral_per_cycle > 0 THEN
          v_referral_bonus := v_config.drop_referral_per_cycle;
          v_admin_fee := v_config.drop_admin_fee - v_referral_bonus; -- Admin gets less
          
          -- INSTANT: Pay referrer their royalty
          INSERT INTO transactions (
            user_id, amount, wallet_type, transaction_type, description, status, metadata
          ) VALUES (
            v_referrer_profile.id,
            v_referral_bonus,
            'earnings',
            'drop_referral_cycle',
            'Referral royalty from ' || v_target_drop.full_name || '''s machine cycle',
            'completed',
            jsonb_build_object(
              'referee_id', v_target_drop.user_id,
              'referee_name', v_target_drop.full_name,
              'drop_id', v_target_drop.id,
              'spot_id', v_target_drop.spot_id
            )
          );
          
          -- Update cached balance for referrer
          UPDATE cached_balances
          SET earnings_balance = earnings_balance + v_referral_bonus,
              last_updated = now()
          WHERE user_id = v_referrer_profile.id;
          
          -- Notify referrer
          INSERT INTO notifications (user_id, title, message, notification_type, metadata)
          VALUES (
            v_referrer_profile.id,
            '💰 Referral Royalty!',
            '₦' || v_referral_bonus::TEXT || ' earned from ' || v_target_drop.full_name || '''s machine cycle!',
            'referral_royalty',
            jsonb_build_object('amount', v_referral_bonus, 'referee_name', v_target_drop.full_name)
          );
        END IF;
      END IF;
      
      -- INSTANT: Pay user their profit
      INSERT INTO transactions (
        user_id, amount, wallet_type, transaction_type, description, status, metadata
      ) VALUES (
        v_target_drop.user_id,
        v_config.drop_profit_amount,
        'earnings',
        'drop_profit',
        'Machine yield - Cycle #' || (SELECT total_cycles FROM spots WHERE id = v_target_drop.spot_id),
        'completed',
        jsonb_build_object(
          'drop_id', v_target_drop.id,
          'spot_id', v_target_drop.spot_id,
          'position', v_target_drop.position
        )
      );
      
      -- Update cached balance for user
      UPDATE cached_balances
      SET earnings_balance = earnings_balance + v_config.drop_profit_amount,
          last_updated = now()
      WHERE user_id = v_target_drop.user_id;
      
      -- Admin fee to system
      IF v_admin_fee > 0 THEN
        INSERT INTO transactions (
          user_id, amount, wallet_type, transaction_type, description, status, metadata
        ) VALUES (
          v_target_drop.user_id,
          -v_admin_fee,
          'system',
          'platform_fee',
          'Machine cycle admin fee',
          'completed',
          jsonb_build_object('drop_id', v_target_drop.id, 'admin_fee', v_admin_fee)
        );
      END IF;
      
      -- Notify user of payout
      INSERT INTO notifications (user_id, title, message, notification_type, metadata)
      VALUES (
        v_target_drop.user_id,
        '🎉 Machine Yield Ready!',
        'Your machine just produced ₦' || v_config.drop_profit_amount::TEXT || ' profit! It''s now refreshing for another cycle.',
        'drop_payout',
        jsonb_build_object(
          'profit', v_config.drop_profit_amount,
          'spot_name', (SELECT spot_name FROM spots WHERE id = v_target_drop.spot_id),
          'total_cycles', (SELECT total_cycles FROM spots WHERE id = v_target_drop.spot_id)
        )
      );
      
      -- AUTO-COMPOUND: Check if user has it enabled and has enough earnings
      IF v_target_drop.auto_compound_enabled THEN
        -- Get user's current earnings balance
        SELECT earnings_balance INTO v_user_earnings
        FROM cached_balances
        WHERE user_id = v_target_drop.user_id;
        
        -- If they have enough for a new machine, auto-purchase it
        IF COALESCE(v_user_earnings, 0) >= v_config.drop_entry_fee THEN
          -- Call create_spot for auto-compound
          SELECT create_spot(v_target_drop.user_id, 'earnings') INTO v_auto_compound_result;
          
          -- Notify user of auto-compound
          INSERT INTO notifications (user_id, title, message, notification_type, metadata)
          VALUES (
            v_target_drop.user_id,
            '⚡ Auto-Compound Activated!',
            'Your profits just bought a new machine! Your portfolio is growing automatically.',
            'auto_compound',
            jsonb_build_object('new_spot', v_auto_compound_result)
          );
        END IF;
      END IF;
    END IF;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'drops_filled', v_drops_filled,
    'payouts_made', v_payouts_made,
    'total_distributed', v_total_distributed,
    'remaining_amount', v_remaining_amount,
    'depth_reached', v_current_depth
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_community_velocity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_community_velocity() TO anon;