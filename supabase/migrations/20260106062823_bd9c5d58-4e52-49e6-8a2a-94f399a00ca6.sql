-- =====================================================
-- CLEANUP: Remove old ₦500 referral system
-- =====================================================

-- Drop the trigger (correct name: on_membership_fee_paid)
DROP TRIGGER IF EXISTS on_membership_fee_paid ON transactions;

-- Now drop the function
DROP FUNCTION IF EXISTS process_referral_commission();

-- Remove the referral_commission_paid column (no longer needed)
ALTER TABLE profiles DROP COLUMN IF EXISTS referral_commission_paid;

-- Set referral_cash_bonus to 0 (cleanup)
UPDATE platform_config SET referral_cash_bonus = 0 WHERE id = 1;

-- =====================================================
-- UPDATE: distribute_liquidity - Use "yield" terminology
-- =====================================================

CREATE OR REPLACE FUNCTION public.distribute_liquidity(_amount numeric, _origin_drop_id uuid, _max_depth integer DEFAULT 5)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_total_yields INTEGER;
BEGIN
  -- Get platform config
  SELECT * INTO v_config FROM platform_config WHERE id = 1;
  
  v_remaining_amount := _amount;
  
  -- Distribution loop - fill buckets until amount exhausted or max depth reached
  WHILE v_remaining_amount > 0 AND v_current_depth < _max_depth LOOP
    v_current_depth := v_current_depth + 1;
    
    -- Find oldest unfilled drop (excluding the origin drop)
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
      
      -- Get total yields for this spot
      SELECT total_cycles INTO v_total_yields FROM spots WHERE id = v_target_drop.spot_id;
      
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
          v_admin_fee := v_config.drop_admin_fee - v_referral_bonus;
          
          -- Pay referrer their yield royalty
          INSERT INTO transactions (
            user_id, amount, wallet_type, transaction_type, description, status, metadata
          ) VALUES (
            v_referrer_profile.id,
            v_referral_bonus,
            'earnings',
            'drop_referral_cycle',
            'Yield royalty from ' || v_target_drop.full_name,
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
            '💰 Yield Royalty!',
            '₦' || v_referral_bonus::TEXT || ' earned from ' || v_target_drop.full_name || '''s machine yield!',
            'referral_royalty',
            jsonb_build_object('amount', v_referral_bonus, 'referee_name', v_target_drop.full_name)
          );
        END IF;
      END IF;
      
      -- Pay user their profit
      INSERT INTO transactions (
        user_id, amount, wallet_type, transaction_type, description, status, metadata
      ) VALUES (
        v_target_drop.user_id,
        v_config.drop_profit_amount,
        'earnings',
        'drop_profit',
        'Machine yield #' || v_total_yields,
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
          'Machine yield fee',
          'completed',
          jsonb_build_object('drop_id', v_target_drop.id, 'admin_fee', v_admin_fee)
        );
      END IF;
      
      -- Notify user of payout
      INSERT INTO notifications (user_id, title, message, notification_type, metadata)
      VALUES (
        v_target_drop.user_id,
        '🎉 Machine Yield Ready!',
        'Your machine just produced ₦' || v_config.drop_profit_amount::TEXT || ' profit! Refreshing for another round.',
        'drop_payout',
        jsonb_build_object(
          'profit', v_config.drop_profit_amount,
          'spot_name', (SELECT spot_name FROM spots WHERE id = v_target_drop.spot_id),
          'total_yields', v_total_yields
        )
      );
      
      -- AUTO-COMPOUND: Check if user has it enabled and has enough earnings
      IF v_target_drop.auto_compound_enabled THEN
        SELECT earnings_balance INTO v_user_earnings
        FROM cached_balances
        WHERE user_id = v_target_drop.user_id;
        
        IF COALESCE(v_user_earnings, 0) >= v_config.drop_entry_fee THEN
          SELECT create_spot(v_target_drop.user_id, 'earnings') INTO v_auto_compound_result;
          
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
$function$;

-- =====================================================
-- UPDATE: get_miner_details - Use "yield" terminology
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_miner_details(_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_referral_code TEXT;
  v_result JSON;
BEGIN
  -- Get user's referral code
  SELECT referral_code INTO v_referral_code
  FROM profiles
  WHERE id = _user_id;
  
  IF v_referral_code IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;
  
  -- Get detailed miner information
  SELECT json_build_object(
    'success', true,
    'miners', COALESCE((
      SELECT json_agg(miner_data ORDER BY miner_data->>'last_activity' DESC NULLS LAST)
      FROM (
        SELECT json_build_object(
          'id', p.id,
          'name', p.full_name,
          'is_member', p.is_member,
          'joined_at', p.created_at,
          'last_activity', COALESCE(
            (SELECT MAX(t.created_at) FROM transactions t WHERE t.user_id = p.id),
            p.created_at
          ),
          'machine_count', COALESCE(
            (SELECT COUNT(*) FROM spots s WHERE s.user_id = p.id AND s.status = 'active'),
            0
          ),
          'total_yields', COALESCE(
            (SELECT SUM(s.total_cycles) FROM spots s WHERE s.user_id = p.id),
            0
          ),
          'referrer_earnings', COALESCE(
            (
              SELECT SUM(t.amount)::NUMERIC
              FROM transactions t
              WHERE t.user_id = _user_id
              AND t.status = 'completed'
              AND t.transaction_type = 'drop_referral_cycle' 
              AND t.metadata->>'referee_id' = p.id::TEXT
            ),
            0
          )
        ) AS miner_data
        FROM profiles p
        WHERE p.referred_by_code = v_referral_code
      ) AS miners
    ), '[]'::json),
    'summary', json_build_object(
      'total_miners', (
        SELECT COUNT(*) FROM profiles WHERE referred_by_code = v_referral_code
      ),
      'active_miners', (
        SELECT COUNT(*) FROM profiles WHERE referred_by_code = v_referral_code AND is_member = true
      ),
      'pending_miners', (
        SELECT COUNT(*) FROM profiles WHERE referred_by_code = v_referral_code AND is_member = false
      ),
      'total_machines_in_network', COALESCE(
        (
          SELECT SUM(spot_count)::INTEGER
          FROM (
            SELECT (SELECT COUNT(*) FROM spots s WHERE s.user_id = p.id AND s.status = 'active') AS spot_count
            FROM profiles p
            WHERE p.referred_by_code = v_referral_code
          ) AS network_spots
        ),
        0
      ),
      'total_network_yields', COALESCE(
        (
          SELECT SUM(total_cycles)::INTEGER
          FROM spots s
          JOIN profiles p ON s.user_id = p.id
          WHERE p.referred_by_code = v_referral_code
        ),
        0
      ),
      'total_royalty_earnings', COALESCE(
        (
          SELECT SUM(t.amount)::NUMERIC
          FROM transactions t
          WHERE t.user_id = _user_id
          AND t.transaction_type = 'drop_referral_cycle'
          AND t.wallet_type = 'earnings'
          AND t.status = 'completed'
        ),
        0
      ),
      'per_yield_potential', (
        SELECT COUNT(*) * 20
        FROM profiles
        WHERE referred_by_code = v_referral_code
        AND is_member = true
      )
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$function$;

-- =====================================================
-- UPDATE: get_community_velocity - Use "yield" terminology
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_community_velocity()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_payouts_last_10_min INTEGER;
  v_payouts_last_hour INTEGER;
  v_avg_yield_time_minutes NUMERIC;
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
  
  -- Calculate average time between yields
  SELECT EXTRACT(EPOCH FROM (now() - COALESCE(v_last_payout_at, now()))) / 60.0
  INTO v_avg_yield_time_minutes;
  
  -- Determine velocity level
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
    'yields_last_10_min', v_payouts_last_10_min,
    'yields_last_hour', v_payouts_last_hour,
    'avg_yield_time_minutes', ROUND(v_avg_yield_time_minutes::numeric, 1),
    'last_yield_at', v_last_payout_at
  );
END;
$function$;