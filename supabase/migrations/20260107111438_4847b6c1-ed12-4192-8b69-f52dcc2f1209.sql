-- Fix distribute_liquidity function: Admin fees should go to SYSTEM_TREASURY
-- with positive amounts to 'earnings' wallet (not to the user with negative 'system' wallet)

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
  v_tier_bonus_percent INTEGER;
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
      v_tier_bonus_percent := 0;
      
      -- Check if user has a referrer for royalty payment
      IF v_target_drop.referred_by_code IS NOT NULL THEN
        -- Find the referrer
        SELECT id, full_name INTO v_referrer_profile
        FROM profiles
        WHERE referral_code = v_target_drop.referred_by_code;
        
        IF v_referrer_profile.id IS NOT NULL AND v_config.drop_referral_per_cycle > 0 THEN
          -- Get the referrer's tier bonus percentage
          v_tier_bonus_percent := get_referrer_tier_bonus(v_referrer_profile.id);
          
          -- Calculate referral bonus with tier bonus applied
          v_referral_bonus := v_config.drop_referral_per_cycle + 
            ROUND((v_config.drop_referral_per_cycle * v_tier_bonus_percent / 100.0)::numeric, 0);
          
          v_admin_fee := v_config.drop_admin_fee - v_referral_bonus;
          
          -- Pay referrer their yield royalty (with tier bonus)
          INSERT INTO transactions (
            user_id, amount, wallet_type, transaction_type, description, status, metadata
          ) VALUES (
            v_referrer_profile.id,
            v_referral_bonus,
            'earnings',
            'drop_referral_cycle',
            CASE 
              WHEN v_tier_bonus_percent > 0 THEN
                format('Yield royalty from %s (+%s%% tier bonus!)', v_target_drop.full_name, v_tier_bonus_percent)
              ELSE
                'Yield royalty from ' || v_target_drop.full_name
            END,
            'completed',
            jsonb_build_object(
              'referee_id', v_target_drop.user_id,
              'referee_name', v_target_drop.full_name,
              'drop_id', v_target_drop.id,
              'spot_id', v_target_drop.spot_id,
              'base_amount', v_config.drop_referral_per_cycle,
              'tier_bonus_percent', v_tier_bonus_percent,
              'bonus_amount', v_referral_bonus - v_config.drop_referral_per_cycle
            )
          );
          
          -- Notify referrer
          INSERT INTO notifications (user_id, title, message, notification_type, metadata)
          VALUES (
            v_referrer_profile.id,
            CASE 
              WHEN v_tier_bonus_percent > 0 THEN '💰 Boosted Yield Royalty!'
              ELSE '💰 Yield Royalty!'
            END,
            CASE 
              WHEN v_tier_bonus_percent > 0 THEN
                format('₦%s earned from %s''s machine! (includes +%s%% tier bonus)', 
                  v_referral_bonus::TEXT, v_target_drop.full_name, v_tier_bonus_percent)
              ELSE
                '₦' || v_referral_bonus::TEXT || ' earned from ' || v_target_drop.full_name || '''s machine yield!'
            END,
            'referral_royalty',
            jsonb_build_object(
              'amount', v_referral_bonus, 
              'referee_name', v_target_drop.full_name,
              'tier_bonus_percent', v_tier_bonus_percent,
              'base_amount', v_config.drop_referral_per_cycle
            )
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
        'Machine payout - Yield #' || v_total_yields,
        'completed',
        jsonb_build_object(
          'drop_id', v_target_drop.id,
          'spot_id', v_target_drop.spot_id,
          'yield_number', v_total_yields
        )
      );
      
      -- ✅ FIXED: Admin fee goes to SYSTEM_TREASURY with positive amount to 'earnings' wallet
      IF v_admin_fee > 0 THEN
        INSERT INTO transactions (
          user_id, amount, wallet_type, transaction_type, description, status, metadata
        ) VALUES (
          '00000000-0000-0000-0000-000000000000',  -- SYSTEM_TREASURY
          v_admin_fee,                              -- Positive amount (income)
          'earnings',                               -- Valid wallet type
          'platform_fee',
          'Machine yield fee',
          'completed',
          jsonb_build_object(
            'drop_id', v_target_drop.id, 
            'admin_fee', v_admin_fee, 
            'from_user', v_target_drop.user_id,
            'from_user_name', v_target_drop.full_name
          )
        );
      END IF;
      
      -- Invalidate cached balance for the user
      DELETE FROM cached_balances WHERE user_id = v_target_drop.user_id;
      
      -- Notify user
      INSERT INTO notifications (user_id, title, message, notification_type, metadata)
      VALUES (
        v_target_drop.user_id,
        '🎉 Machine Payout!',
        format('Your machine just yielded ₦%s profit! Yield #%s', v_config.drop_profit_amount, v_total_yields),
        'drop_payout',
        jsonb_build_object(
          'amount', v_config.drop_profit_amount,
          'yield_number', v_total_yields,
          'drop_id', v_target_drop.id
        )
      );
    END IF;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'drops_filled', v_drops_filled,
    'payouts_made', v_payouts_made,
    'total_distributed', v_total_distributed,
    'remaining', v_remaining_amount,
    'depth_reached', v_current_depth
  );
END;
$function$;