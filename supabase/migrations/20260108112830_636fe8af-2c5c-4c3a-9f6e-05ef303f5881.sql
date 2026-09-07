-- =====================================================
-- GENESIS LOCK SYSTEM - Complete Backend Implementation
-- =====================================================

-- Step 1: Add new transaction types for genesis
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'genesis_yield';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'genesis_transfer';

-- Step 2: Update create_spot to mark FIRST spot as genesis
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
  v_is_first_spot BOOLEAN;
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
  SELECT COUNT(*) INTO v_spot_count FROM spots WHERE user_id = _user_id;
  
  -- Check if this is the user's FIRST spot (for Genesis)
  v_is_first_spot := (v_spot_count = 0);
  
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
  
  -- Create the spot with GENESIS flags if first spot
  INSERT INTO spots (
    user_id, 
    spot_name, 
    status,
    is_genesis_spot,
    genesis_yields_remaining
  )
  VALUES (
    _user_id, 
    v_spot_name, 
    'active',
    v_is_first_spot,
    CASE WHEN v_is_first_spot THEN 3 ELSE 0 END
  )
  RETURNING id INTO v_spot_id;
  
  -- Get next position in line
  SELECT get_next_drop_position() INTO v_position;
  
  -- Create the drop entry (marked as settled since we process immediately)
  INSERT INTO drops (spot_id, position, status, source_type, is_settled)
  VALUES (v_spot_id, v_position, 'waiting', 'new', true)
  RETURNING id INTO v_drop_id;
  
  -- Distribute the entry fee to fill buckets
  SELECT distribute_liquidity(
    v_drop_id,
    v_config.drop_entry_fee,
    10
  ) INTO v_distribution_result;
  
  -- Create notification for user
  IF v_is_first_spot THEN
    -- Genesis notification
    PERFORM create_notification(
      _user_id := _user_id,
      _type := 'genesis_started',
      _title := 'Genesis Mode Active!',
      _message := format('Your %s is now active at Position #%s. Your first 3 payouts will automatically build you a SECOND machine!', v_spot_name, v_position)
    );
  ELSE
    -- Normal notification
    PERFORM create_notification(
      _user_id := _user_id,
      _type := 'spot_created',
      _title := format('%s is now active!', v_spot_name),
      _message := format('You are now Position #%s in The Viketa Line. When 2 people join after you, you earn!', v_position)
    );
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'spot_id', v_spot_id,
    'drop_id', v_drop_id,
    'position', v_position,
    'spot_name', v_spot_name,
    'is_genesis_spot', v_is_first_spot,
    'distribution', v_distribution_result
  );
END;
$function$;

-- Step 3: Update pay_user_profit to handle Genesis Lock
CREATE OR REPLACE FUNCTION public.pay_user_profit(_user_id uuid, _spot_id uuid, _profit_amount numeric, _auto_compound boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_spot RECORD;
  v_deposit_balance NUMERIC;
  v_entry_fee NUMERIC;
  v_leftover NUMERIC;
  v_spot_result JSON;
  v_earnings_balance NUMERIC;
BEGIN
  -- Get spot genesis status
  SELECT is_genesis_spot, genesis_yields_remaining
  INTO v_spot
  FROM spots WHERE id = _spot_id;

  -- =====================================================
  -- GENESIS MODE: First 3 cycles go to deposit wallet
  -- =====================================================
  IF v_spot.is_genesis_spot AND v_spot.genesis_yields_remaining > 0 THEN
    
    -- Pay to DEPOSIT wallet (locked for genesis)
    INSERT INTO transactions (
      user_id, amount, transaction_type, wallet_type, description, status, metadata
    ) VALUES (
      _user_id,
      _profit_amount,
      'genesis_yield',
      'deposit',
      format('Genesis cycle %s/3 - Building your second machine...', 4 - v_spot.genesis_yields_remaining),
      'completed',
      json_build_object('genesis_cycle', 4 - v_spot.genesis_yields_remaining, 'spot_id', _spot_id)
    );
    
    -- Decrement genesis counter
    UPDATE spots 
    SET genesis_yields_remaining = genesis_yields_remaining - 1
    WHERE id = _spot_id;
    
    -- Check if this was the 3rd cycle (counter was 1, now becomes 0)
    IF v_spot.genesis_yields_remaining = 1 THEN
      
      -- Get config and deposit balance AFTER this transaction
      SELECT drop_entry_fee INTO v_entry_fee FROM platform_config WHERE id = 1;
      SELECT check_balance(_user_id, 'deposit') INTO v_deposit_balance;
      
      -- Should have ₦1,200 (3 x ₦400)
      IF v_deposit_balance >= v_entry_fee THEN
        
        -- Auto-buy Machine 2 from deposit wallet!
        SELECT create_spot(_user_id, 'deposit') INTO v_spot_result;
        
        IF (v_spot_result->>'success')::boolean THEN
          -- Move leftover to earnings (should be ₦200)
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
            
            -- Transfer into earnings (user's first taste of cash!)
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
          _profit_amount, v_spot.genesis_yields_remaining - 1)
      );
    END IF;
    
    RETURN; -- Exit - genesis handled, don't do normal payout
  END IF;

  -- =====================================================
  -- NORMAL MODE: Regular payout to earnings wallet
  -- =====================================================
  INSERT INTO transactions (
    user_id, amount, transaction_type, wallet_type, description, status, metadata
  ) VALUES (
    _user_id,
    _profit_amount,
    'drop_profit',
    'earnings',
    CASE WHEN _auto_compound 
      THEN 'Machine payout - Empire Builder active'
      ELSE 'Machine payout - Ready to withdraw!'
    END,
    'completed',
    json_build_object('auto_compounded', _auto_compound)
  );
  
  -- If auto-compound is enabled, check if we can auto-buy a new machine
  IF _auto_compound THEN
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
  END IF;
END;
$function$;

-- Step 4: Update distribute_liquidity to pass spot_id to pay_user_profit
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
  v_should_auto_compound BOOLEAN;
BEGIN
  -- Get platform config
  SELECT * INTO v_config FROM platform_config WHERE id = 1;
  
  -- Process liquidity distribution
  WHILE v_remaining > 0 AND v_depth < _max_depth LOOP
    v_depth := v_depth + 1;
    
    -- Find the oldest unfilled drop (excluding the origin)
    SELECT d.*, s.id as spot_id, s.user_id as spot_owner_id,
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
      v_spot_owner_id := v_target_drop.spot_owner_id;
      v_should_auto_compound := COALESCE(v_target_drop.auto_compound_enabled, false);
      
      -- ==========================================
      -- STEP 1: Pay referral bonus (if applicable)
      -- ==========================================
      PERFORM pay_referral_bonus(
        v_target_drop.referred_by_code,
        v_spot_owner_id,
        v_config.drop_referral_per_cycle
      );
      
      -- ==========================================
      -- STEP 2: Pay user profit (NOW WITH SPOT_ID for Genesis!)
      -- ==========================================
      PERFORM pay_user_profit(
        v_spot_owner_id,
        v_target_drop.spot_id,  -- Pass spot_id for genesis check
        v_config.drop_profit_amount,
        v_should_auto_compound
      );
      
      -- ==========================================
      -- STEP 3: Pay admin fee
      -- ==========================================
      PERFORM pay_admin_fee(
        v_target_drop.id,
        v_spot_owner_id,
        v_config.drop_admin_fee
      );
      
      -- ==========================================
      -- STEP 4: Update spot statistics
      -- ==========================================
      PERFORM update_spot_stats(
        v_target_drop.spot_id,
        v_config.drop_profit_amount
      );
      
      -- Mark drop as paid
      UPDATE drops 
      SET status = 'paid', paid_at = now()
      WHERE id = v_target_drop.id;
      
      -- ==========================================
      -- STEP 5: Send notification (skip if genesis handled it)
      -- ==========================================
      -- Genesis mode sends its own notifications, so we skip here
      -- Check if NOT genesis spot or genesis already complete
      IF NOT (SELECT is_genesis_spot AND genesis_yields_remaining >= 0 FROM spots WHERE id = v_target_drop.spot_id) THEN
        PERFORM send_payout_notification(
          v_spot_owner_id,
          v_config.drop_profit_amount,
          v_should_auto_compound
        );
      END IF;
      
      -- ==========================================
      -- STEP 6: Create re-entry drop
      -- ==========================================
      PERFORM create_reentry_drop(v_target_drop.spot_id);
      v_reentries_made := v_reentries_made + 1;
      
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