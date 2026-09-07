-- Fix distribute_liquidity to auto-create 2nd machine when genesis completes
CREATE OR REPLACE FUNCTION public.distribute_liquidity(_origin_drop_id uuid, _amount numeric, _max_depth integer DEFAULT 100)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_new_drop_id UUID;
  v_new_position INTEGER;
  v_referrer_id UUID;
  v_should_auto_compound BOOLEAN;
  v_genesis_remaining INTEGER;
  v_is_genesis_spot BOOLEAN;
  v_user_auto_compound BOOLEAN;
  -- NEW: For genesis completion
  v_user_spot_count INTEGER;
  v_new_genesis_spot_id UUID;
  v_new_genesis_position INTEGER;
BEGIN
  -- Get platform config
  SELECT * INTO v_config FROM platform_config WHERE id = 1;
  
  -- Process liquidity distribution
  WHILE v_remaining > 0 AND v_depth < _max_depth LOOP
    v_depth := v_depth + 1;
    
    -- Find the oldest unfilled drop (excluding the origin)
    SELECT d.*, s.user_id as spot_owner_id, s.is_genesis_spot, s.genesis_yields_remaining,
           p.auto_compound_enabled, p.referred_by_code
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
    
    -- Check if this drop is now complete (bucket full)
    IF v_target_drop.fill_amount + v_amount_to_fill >= v_target_drop.target_amount THEN
      v_payouts_made := v_payouts_made + 1;
      
      -- Get spot owner info
      v_spot_owner_id := v_target_drop.spot_owner_id;
      v_is_genesis_spot := v_target_drop.is_genesis_spot;
      v_genesis_remaining := v_target_drop.genesis_yields_remaining;
      v_user_auto_compound := v_target_drop.auto_compound_enabled;
      
      -- Determine if we should auto-compound
      -- Genesis spot with remaining yields = FORCED auto-compound
      IF v_is_genesis_spot AND v_genesis_remaining > 0 THEN
        v_should_auto_compound := true;
        
        -- Decrement genesis counter on the SPOT
        UPDATE spots 
        SET genesis_yields_remaining = genesis_yields_remaining - 1
        WHERE id = v_target_drop.spot_id;
        
        v_genesis_remaining := v_genesis_remaining - 1;
        
        -- ============================================
        -- NEW: Check if genesis just completed (reached 0)
        -- ============================================
        IF v_genesis_remaining = 0 THEN
          -- Mark profile as genesis completed
          UPDATE profiles 
          SET genesis_completed_at = NOW()
          WHERE id = v_spot_owner_id 
            AND genesis_completed_at IS NULL;
          
          -- Count user's current active spots
          SELECT COUNT(*) INTO v_user_spot_count 
          FROM spots 
          WHERE user_id = v_spot_owner_id AND status = 'active';
          
          -- Create the 2nd machine (only if they have exactly 1 spot)
          IF v_user_spot_count = 1 THEN
            -- Create new spot (Machine 2)
            INSERT INTO spots (user_id, spot_name, status, is_genesis_spot, genesis_yields_remaining)
            VALUES (v_spot_owner_id, 'Machine 2', 'active', false, 0)
            RETURNING id INTO v_new_genesis_spot_id;
            
            -- Get next position for the new machine
            SELECT get_next_drop_position() INTO v_new_genesis_position;
            
            -- Create drop for the new spot
            INSERT INTO drops (spot_id, position, status, source_type, is_settled)
            VALUES (v_new_genesis_spot_id, v_new_genesis_position, 'waiting', 'new', true);
            
            -- Send genesis complete notification
            PERFORM create_notification(
              _user_id := v_spot_owner_id,
              _type := 'genesis_complete',
              _title := 'Genesis Complete! New Machine Added!',
              _message := format('Congratulations! You completed 3 Genesis Yields. Your Machine 2 is now active at Position #%s!', v_new_genesis_position)
            );
          END IF;
        END IF;
      ELSE
        -- Non-genesis or genesis complete: respect user's toggle
        v_should_auto_compound := v_user_auto_compound;
      END IF;
      
      -- Pay referral bonus (always, regardless of genesis)
      IF v_target_drop.referred_by_code IS NOT NULL AND v_config.drop_referral_per_cycle > 0 THEN
        SELECT id INTO v_referrer_id 
        FROM profiles 
        WHERE referral_code = v_target_drop.referred_by_code;
        
        IF v_referrer_id IS NOT NULL THEN
          -- Pay referrer their per-cycle bonus
          INSERT INTO transactions (
            user_id, amount, transaction_type, wallet_type, description, status, metadata
          ) VALUES (
            v_referrer_id,
            v_config.drop_referral_per_cycle,
            'drop_referral_cycle',
            'earnings',
            'Royalty from your recruit''s machine cycle',
            'completed',
            json_build_object('referee_id', v_spot_owner_id)
          );
          
          -- Invalidate referrer's cached balance
          DELETE FROM cached_balances WHERE user_id = v_referrer_id;
        END IF;
      END IF;
      
      -- Handle profit based on auto-compound setting
      IF v_should_auto_compound THEN
        -- AUTO-COMPOUND: Profit goes to deposit wallet for buying more spots
        INSERT INTO transactions (
          user_id, amount, transaction_type, wallet_type, description, status,
          metadata
        ) VALUES (
          v_spot_owner_id,
          v_config.drop_profit_amount,
          'drop_profit',
          'deposit',
          CASE 
            WHEN v_is_genesis_spot AND v_genesis_remaining >= 0 THEN
              format('Genesis Yield %s/3 - Building your fleet!', 3 - v_genesis_remaining)
            ELSE
              'Auto-compound: Profit added to your empire fund'
          END,
          'completed',
          json_build_object('auto_compounded', true, 'genesis_yield', v_is_genesis_spot AND v_genesis_remaining >= 0)
        );
      ELSE
        -- CASH OUT: Profit goes to earnings wallet (withdrawable)
        INSERT INTO transactions (
          user_id, amount, transaction_type, wallet_type, description, status,
          metadata
        ) VALUES (
          v_spot_owner_id,
          v_config.drop_profit_amount,
          'drop_profit',
          'earnings',
          'Machine payout - Ready to withdraw!',
          'completed',
          json_build_object('auto_compounded', false)
        );
      END IF;
      
      -- Invalidate owner's cached balance
      DELETE FROM cached_balances WHERE user_id = v_spot_owner_id;
      
      -- Update spot stats
      UPDATE spots 
      SET total_cycles = total_cycles + 1,
          total_earnings = total_earnings + v_config.drop_profit_amount
      WHERE id = v_target_drop.spot_id;
      
      -- Mark drop as paid
      UPDATE drops 
      SET status = 'paid', paid_at = now()
      WHERE id = v_target_drop.id;
      
      -- Create payout notification (only for non-genesis completion cases)
      IF NOT (v_is_genesis_spot AND v_genesis_remaining = 0) THEN
        PERFORM create_notification(
          _user_id := v_spot_owner_id,
          _type := 'drop_payout',
          _title := CASE 
            WHEN v_is_genesis_spot AND v_genesis_remaining > 0 THEN
              format('Genesis Yield %s/3 Complete!', 3 - v_genesis_remaining)
            ELSE
              'Machine Payout!'
          END,
          _message := CASE 
            WHEN v_should_auto_compound THEN
              format('₦%s added to your empire fund. Building your fleet!', v_config.drop_profit_amount)
            ELSE
              format('₦%s profit ready to withdraw!', v_config.drop_profit_amount)
          END
        );
      END IF;
      
      -- Create re-entry drop
      v_reentries_made := v_reentries_made + 1;
      
      SELECT get_next_drop_position() INTO v_new_position;
      
      INSERT INTO drops (spot_id, position, status, source_type, is_settled)
      VALUES (v_target_drop.spot_id, v_new_position, 'waiting', 're-entry', false)
      RETURNING id INTO v_new_drop_id;
      
      -- Calculate overflow (any extra beyond target)
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
$function$;

-- Also fix check_balance to only count completed transactions
CREATE OR REPLACE FUNCTION public.check_balance(_user_id uuid, _wallet_type wallet_type)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(amount), 0)
  FROM public.transactions
  WHERE user_id = _user_id 
    AND wallet_type = _wallet_type
    AND status = 'completed'
$function$;