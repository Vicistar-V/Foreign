-- =====================================================
-- STOP DELETING CACHED_BALANCES IN GAME ENGINE
-- The trigger handles cache updates automatically
-- =====================================================

-- Fix create_spot: Remove the DELETE statement
CREATE OR REPLACE FUNCTION public.create_spot(_user_id uuid, _source_wallet wallet_type DEFAULT 'deposit'::wallet_type)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_config RECORD;
  v_balance NUMERIC;
  v_spot_id UUID;
  v_drop_id UUID;
  v_position INTEGER;
  v_spot_count INTEGER;
  v_is_genesis BOOLEAN;
  v_genesis_yields INTEGER;
  v_spot_name TEXT;
BEGIN
  -- Get platform config
  SELECT * INTO v_config FROM platform_config WHERE id = 1;
  
  -- Check if drop system is active
  IF NOT v_config.drop_system_active THEN
    RETURN json_build_object('success', false, 'error', 'The Viketa Line is currently paused');
  END IF;
  
  -- Check balance in source wallet
  SELECT check_balance(_user_id, _source_wallet) INTO v_balance;
  
  IF v_balance < v_config.drop_entry_fee THEN
    RETURN json_build_object(
      'success', false, 
      'error', format('Not enough money in your %s wallet. You need ₦%s but have ₦%s', 
        _source_wallet, v_config.drop_entry_fee, v_balance)
    );
  END IF;
  
  -- Count existing spots for this user
  SELECT COUNT(*) INTO v_spot_count FROM spots WHERE user_id = _user_id AND status = 'active';
  
  -- Determine if this is a genesis spot (first spot only)
  IF v_spot_count = 0 THEN
    v_is_genesis := true;
    v_genesis_yields := 3;
    v_spot_name := 'Machine 1';
  ELSE
    v_is_genesis := false;
    v_genesis_yields := 0;
    v_spot_name := format('Machine %s', v_spot_count + 1);
  END IF;
  
  -- Deduct entry fee from source wallet
  -- NOTE: The trigger update_cached_balances_on_transaction will auto-update the cache
  INSERT INTO transactions (
    user_id,
    amount,
    transaction_type,
    wallet_type,
    description,
    status
  ) VALUES (
    _user_id,
    -v_config.drop_entry_fee,
    'drop_entry',
    _source_wallet,
    format('Bought %s - joined The Viketa Line', v_spot_name),
    'completed'
  );
  
  -- NO DELETE! The trigger handles cache updates automatically
  
  -- Create the spot with genesis info
  INSERT INTO spots (user_id, spot_name, status, is_genesis_spot, genesis_yields_remaining)
  VALUES (_user_id, v_spot_name, 'active', v_is_genesis, v_genesis_yields)
  RETURNING id INTO v_spot_id;
  
  -- Get next position in line
  SELECT get_next_drop_position() INTO v_position;
  
  -- Create the drop entry
  INSERT INTO drops (spot_id, position, status, source_type, is_settled)
  VALUES (v_spot_id, v_position, 'waiting', 'new', false)
  RETURNING id INTO v_drop_id;
  
  -- Create notification for user
  PERFORM create_notification(
    _user_id := _user_id,
    _type := 'spot_created',
    _title := format('%s is now active!', v_spot_name),
    _message := format('You are now Position #%s in The Viketa Line. When 2 people join after you, you earn!', v_position)
  );
  
  RETURN json_build_object(
    'success', true,
    'spot_id', v_spot_id,
    'drop_id', v_drop_id,
    'position', v_position,
    'spot_name', v_spot_name,
    'is_genesis_spot', v_is_genesis,
    'genesis_yields_remaining', v_genesis_yields
  );
END;
$function$;

-- Fix distribute_liquidity: Remove DELETE statements for owner and referrer
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
          -- NOTE: The trigger will auto-update referrer's cached_balances
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
          
          -- NO DELETE! Trigger handles cache update
          
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
      -- NOTE: The trigger will auto-update owner's cached_balances
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
      
      -- NO DELETE! Trigger handles cache update
      
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
        -- Use check_balance for accurate ledger sum
        SELECT check_balance(v_target_drop.user_id, 'earnings') INTO v_user_earnings;
        
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

-- Backfill any missing cached_balances rows
INSERT INTO cached_balances (user_id, earnings_balance, deposit_balance, last_updated)
SELECT 
  p.id,
  COALESCE((SELECT SUM(amount) FROM transactions WHERE user_id = p.id AND wallet_type = 'earnings' AND status = 'completed'), 0),
  COALESCE((SELECT SUM(amount) FROM transactions WHERE user_id = p.id AND wallet_type = 'deposit' AND status = 'completed'), 0),
  NOW()
FROM profiles p
WHERE p.id != '00000000-0000-0000-0000-000000000000'
  AND NOT EXISTS (SELECT 1 FROM cached_balances cb WHERE cb.user_id = p.id)
ON CONFLICT (user_id) DO NOTHING;