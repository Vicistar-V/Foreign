-- =====================================================
-- PART 1: Turn off auto-compound for ALL users and change default
-- =====================================================

-- Turn off auto-compound for everyone
UPDATE profiles 
SET auto_compound_enabled = false 
WHERE auto_compound_enabled = true OR auto_compound_enabled IS NULL;

-- Change the default to FALSE for new users
ALTER TABLE profiles 
ALTER COLUMN auto_compound_enabled SET DEFAULT false;

-- =====================================================
-- PART 2: Clean up distribute_liquidity - REMOVE ALL GENESIS LOGIC
-- =====================================================

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
BEGIN
  -- Get platform config
  SELECT * INTO v_config FROM platform_config WHERE id = 1;
  
  -- Process liquidity distribution
  WHILE v_remaining > 0 AND v_depth < _max_depth LOOP
    v_depth := v_depth + 1;
    
    -- Find the oldest unfilled drop (excluding the origin)
    SELECT d.*, s.user_id as spot_owner_id,
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
    
    -- Check if this drop is now complete (bucket full at 1500)
    IF v_target_drop.fill_amount + v_amount_to_fill >= v_target_drop.target_amount THEN
      v_payouts_made := v_payouts_made + 1;
      
      -- Get spot owner info
      v_spot_owner_id := v_target_drop.spot_owner_id;
      
      -- Simple: Use user's auto-compound setting (defaults to FALSE now)
      v_should_auto_compound := COALESCE(v_target_drop.auto_compound_enabled, false);
      
      -- Pay referral bonus (₦20 per cycle)
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
          'Auto-compound: Profit added to your empire fund',
          'completed',
          json_build_object('auto_compounded', true)
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
      
      -- Create payout notification
      PERFORM create_notification(
        _user_id := v_spot_owner_id,
        _type := 'drop_payout',
        _title := 'Machine Payout!',
        _message := CASE 
          WHEN v_should_auto_compound THEN
            format('₦%s added to your empire fund. Building your fleet!', v_config.drop_profit_amount)
          ELSE
            format('₦%s profit ready to withdraw!', v_config.drop_profit_amount)
        END
      );
      
      -- Create re-entry drop (machine goes back to end of line)
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

-- =====================================================
-- PART 3: Clean up create_spot - REMOVE GENESIS FLAGS
-- =====================================================

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
  v_spot_name TEXT;
  v_distribution_result JSON;
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
  
  -- Simple naming: Machine 1, Machine 2, etc.
  v_spot_name := format('Machine %s', v_spot_count + 1);
  
  -- Deduct entry fee from source wallet
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
  
  -- Create the spot (NO genesis flags)
  INSERT INTO spots (user_id, spot_name, status)
  VALUES (_user_id, v_spot_name, 'active')
  RETURNING id INTO v_spot_id;
  
  -- Get next position in line
  SELECT get_next_drop_position() INTO v_position;
  
  -- Create the drop entry (marked as settled since we process immediately)
  INSERT INTO drops (spot_id, position, status, source_type, is_settled)
  VALUES (v_spot_id, v_position, 'waiting', 'new', true)
  RETURNING id INTO v_drop_id;
  
  -- Distribute the entry fee to fill buckets
  SELECT distribute_liquidity(
    v_drop_id,                 -- Origin drop (don't fill your own bucket)
    v_config.drop_entry_fee,   -- Amount to distribute (₦1,000)
    10                         -- Max cascade depth
  ) INTO v_distribution_result;
  
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
    'distribution', v_distribution_result
  );
END;
$function$;