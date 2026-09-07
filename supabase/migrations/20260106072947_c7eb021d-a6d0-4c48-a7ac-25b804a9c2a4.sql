-- Add genesis_yields_remaining column to profiles
ALTER TABLE profiles 
ADD COLUMN genesis_yields_remaining INTEGER DEFAULT 3;

-- Grandfather existing users who have completed cycles - they keep current settings
UPDATE profiles SET genesis_yields_remaining = 0 
WHERE id IN (
  SELECT DISTINCT s.user_id 
  FROM spots s 
  WHERE s.total_cycles > 0
);

-- Update the distribute_liquidity function to handle genesis lock
CREATE OR REPLACE FUNCTION distribute_liquidity(
  _origin_drop_id UUID,
  _amount NUMERIC,
  _max_depth INTEGER DEFAULT 100
) RETURNS JSON
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
  v_total_yields INTEGER;
  v_genesis_remaining INTEGER;
  v_should_auto_compound BOOLEAN;
BEGIN
  -- Get platform config
  SELECT * INTO v_config FROM platform_config WHERE id = 1;
  
  v_remaining_amount := _amount;
  
  -- Distribution loop - fill buckets until amount exhausted or max depth reached
  WHILE v_remaining_amount > 0 AND v_current_depth < _max_depth LOOP
    v_current_depth := v_current_depth + 1;
    
    -- Find oldest unfilled drop (excluding the origin drop)
    SELECT d.*, s.user_id, p.full_name, p.referred_by_code, p.auto_compound_enabled, p.genesis_yields_remaining
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
      
      -- Get current genesis remaining and decrement if applicable
      v_genesis_remaining := COALESCE(v_target_drop.genesis_yields_remaining, 0);
      IF v_genesis_remaining > 0 THEN
        UPDATE profiles 
        SET genesis_yields_remaining = genesis_yields_remaining - 1
        WHERE id = v_target_drop.user_id;
        v_genesis_remaining := v_genesis_remaining - 1;
      END IF;
      
      -- Determine if we should auto-compound (Genesis Lock forces it ON, otherwise user preference)
      -- Note: v_genesis_remaining here is AFTER decrement, so > 0 means still in genesis phase
      v_should_auto_compound := (v_genesis_remaining > 0) OR COALESCE(v_target_drop.auto_compound_enabled, false);
      
      -- If user just exited genesis (was 1, now 0), also auto-compound this yield
      IF v_target_drop.genesis_yields_remaining = 1 THEN
        v_should_auto_compound := true;
      END IF;
      
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
          'position', v_target_drop.position,
          'genesis_remaining', v_genesis_remaining
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
      
      -- Notify user of payout - different message during genesis
      IF v_genesis_remaining > 0 THEN
        INSERT INTO notifications (user_id, title, message, notification_type, metadata)
        VALUES (
          v_target_drop.user_id,
          '🔒 Genesis Yield #' || (3 - v_genesis_remaining) || '/3',
          '₦' || v_config.drop_profit_amount::TEXT || ' added to your portfolio fund! ' || v_genesis_remaining || ' yields left until your 2nd machine!',
          'genesis_yield',
          jsonb_build_object(
            'profit', v_config.drop_profit_amount,
            'spot_name', (SELECT spot_name FROM spots WHERE id = v_target_drop.spot_id),
            'total_yields', v_total_yields,
            'genesis_remaining', v_genesis_remaining
          )
        );
      ELSIF v_target_drop.genesis_yields_remaining = 1 THEN
        -- This was the final genesis yield
        INSERT INTO notifications (user_id, title, message, notification_type, metadata)
        VALUES (
          v_target_drop.user_id,
          '🎉 Genesis Complete!',
          'Final genesis yield of ₦' || v_config.drop_profit_amount::TEXT || '! You now control your compound settings.',
          'genesis_complete',
          jsonb_build_object(
            'profit', v_config.drop_profit_amount,
            'spot_name', (SELECT spot_name FROM spots WHERE id = v_target_drop.spot_id),
            'total_yields', v_total_yields
          )
        );
      ELSE
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
      END IF;
      
      -- AUTO-COMPOUND: Check if should compound (genesis forced OR user enabled)
      IF v_should_auto_compound THEN
        SELECT earnings_balance INTO v_user_earnings
        FROM cached_balances
        WHERE user_id = v_target_drop.user_id;
        
        IF COALESCE(v_user_earnings, 0) >= v_config.drop_entry_fee THEN
          SELECT create_spot(v_target_drop.user_id, 'earnings') INTO v_auto_compound_result;
          
          -- Different notification for genesis vs normal auto-compound
          IF v_genesis_remaining >= 0 AND v_target_drop.genesis_yields_remaining > 0 THEN
            INSERT INTO notifications (user_id, title, message, notification_type, metadata)
            VALUES (
              v_target_drop.user_id,
              '🚀 2nd Machine Activated!',
              'Your Genesis Phase is complete! You now have 2 machines earning for you. Your earnings just doubled!',
              'genesis_machine_created',
              jsonb_build_object('new_spot', v_auto_compound_result)
            );
          ELSE
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