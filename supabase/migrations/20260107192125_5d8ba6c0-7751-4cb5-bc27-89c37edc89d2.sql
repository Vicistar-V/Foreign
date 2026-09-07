-- ===========================================
-- FIX: Genesis System Not Working
-- Root cause: Wrong distribute_liquidity function being called
-- ===========================================

-- Step 1: Drop the broken overloaded function (wrong parameter order, no genesis logic)
DROP FUNCTION IF EXISTS distribute_liquidity(numeric, uuid, integer);

-- Step 2: Update create_spot to use correct parameter order
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
  
  -- Create the spot with genesis info
  INSERT INTO spots (user_id, spot_name, status, is_genesis_spot, genesis_yields_remaining)
  VALUES (_user_id, v_spot_name, 'active', v_is_genesis, v_genesis_yields)
  RETURNING id INTO v_spot_id;
  
  -- Get next position in line
  SELECT get_next_drop_position() INTO v_position;
  
  -- Create the drop entry (marked as settled since we process immediately)
  INSERT INTO drops (spot_id, position, status, source_type, is_settled)
  VALUES (v_spot_id, v_position, 'waiting', 'new', true)
  RETURNING id INTO v_drop_id;
  
  -- ============================================
  -- CRITICAL FIX: Correct parameter order!
  -- distribute_liquidity(_origin_drop_id, _amount, _max_depth)
  -- ============================================
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
    'is_genesis_spot', v_is_genesis,
    'genesis_yields_remaining', v_genesis_yields,
    'distribution', v_distribution_result
  );
END;
$function$;

-- Step 3: Update process_reentry_pulse to use correct parameter order
CREATE OR REPLACE FUNCTION public.process_reentry_pulse()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pulse_id UUID;
  v_pulse_number INTEGER;
  v_re_entries_processed INTEGER := 0;
  v_payouts_triggered INTEGER := 0;
  v_total_distributed NUMERIC := 0;
  v_config RECORD;
  v_pending_spot RECORD;
  v_new_drop_id UUID;
  v_new_position INTEGER;
  v_distribution_result JSON;
BEGIN
  -- Get platform config
  SELECT * INTO v_config FROM platform_config WHERE id = 1;
  
  -- Check if drop system is active
  IF NOT v_config.drop_system_active THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Drop system is not active'
    );
  END IF;
  
  -- Get next pulse number
  SELECT COALESCE(MAX(pulse_number), 0) + 1 INTO v_pulse_number FROM drop_pulses;
  
  -- Create pulse record
  INSERT INTO drop_pulses (pulse_number, status)
  VALUES (v_pulse_number, 'running')
  RETURNING id INTO v_pulse_id;
  
  -- Process all spots in pending_redrop status
  FOR v_pending_spot IN 
    SELECT s.*, p.full_name as user_name
    FROM spots s
    JOIN profiles p ON p.id = s.user_id
    WHERE s.status = 'pending_redrop'
    ORDER BY s.created_at ASC
  LOOP
    v_re_entries_processed := v_re_entries_processed + 1;
    
    -- Get next position for re-entry
    SELECT COALESCE(MAX(position), 0) + 1 INTO v_new_position FROM drops;
    
    -- Create new drop at the back of the queue
    INSERT INTO drops (spot_id, position, fill_amount, target_amount, status, source_type, is_settled)
    VALUES (
      v_pending_spot.id,
      v_new_position,
      0,
      v_config.drop_target_amount,
      'waiting',
      're-entry',
      true  -- Marked as settled since we process immediately
    )
    RETURNING id INTO v_new_drop_id;
    
    -- Mark spot as active again
    UPDATE spots 
    SET status = 'active'
    WHERE id = v_pending_spot.id;
    
    -- Mark old completed drop as re-entered
    UPDATE drops 
    SET status = 're-entered'
    WHERE spot_id = v_pending_spot.id 
      AND status = 'pending_redrop';
    
    -- ============================================
    -- CRITICAL FIX: Correct parameter order!
    -- distribute_liquidity(_origin_drop_id, _amount, _max_depth)
    -- ============================================
    SELECT distribute_liquidity(v_new_drop_id, v_config.drop_reentry_amount, 5) INTO v_distribution_result;
    
    -- Track payouts from this distribution
    v_payouts_triggered := v_payouts_triggered + COALESCE((v_distribution_result->>'payouts_made')::INTEGER, 0);
    v_total_distributed := v_total_distributed + COALESCE((v_distribution_result->>'distributed')::NUMERIC, 0);
    
    -- Notify user about their re-entry
    INSERT INTO notifications (user_id, title, message, notification_type, link, metadata)
    VALUES (
      v_pending_spot.user_id,
      'Cycle Refreshed!',
      format('Your %s is back in The Line at Position #%s. Ready for another round!', v_pending_spot.spot_name, v_new_position),
      'drop_joined',
      '/dashboard',
      json_build_object('spot_name', v_pending_spot.spot_name, 'position', v_new_position, 'cycle', v_pending_spot.total_cycles + 1)
    );
  END LOOP;
  
  -- Update pulse record
  UPDATE drop_pulses
  SET 
    completed_at = NOW(),
    new_drops_processed = 0,
    re_entries_processed = v_re_entries_processed,
    payouts_made = v_payouts_triggered,
    total_distributed = v_total_distributed,
    status = 'completed'
  WHERE id = v_pulse_id;
  
  RETURN json_build_object(
    'success', true,
    'pulse_number', v_pulse_number,
    're_entries_processed', v_re_entries_processed,
    'payouts_triggered', v_payouts_triggered,
    'total_distributed', v_total_distributed
  );
END;
$function$;

-- Step 4: Backfill the broken genesis counters
UPDATE spots 
SET genesis_yields_remaining = GREATEST(0, 3 - total_cycles)
WHERE is_genesis_spot = true;

-- Step 5: Complete genesis for users who have completed 3+ cycles
-- First, mark their profiles as genesis completed
UPDATE profiles p
SET genesis_completed_at = NOW()
WHERE genesis_completed_at IS NULL
  AND EXISTS (
    SELECT 1 FROM spots s 
    WHERE s.user_id = p.id 
      AND s.is_genesis_spot = true 
      AND s.total_cycles >= 3
  );

-- Step 6: Create 2nd machines for users who completed genesis but don't have them yet
-- This is for Victor and Vivian specifically
DO $$
DECLARE
  v_user RECORD;
  v_new_spot_id UUID;
  v_new_position INTEGER;
  v_new_drop_id UUID;
  v_spot_count INTEGER;
BEGIN
  -- Find users who completed genesis (3+ cycles) but only have 1 spot
  FOR v_user IN 
    SELECT p.id as user_id, p.full_name
    FROM profiles p
    JOIN spots s ON s.user_id = p.id
    WHERE s.is_genesis_spot = true 
      AND s.total_cycles >= 3
      AND s.status = 'active'
    GROUP BY p.id, p.full_name
    HAVING COUNT(*) = 1  -- Only 1 active spot means they need their 2nd machine
  LOOP
    -- Get current spot count
    SELECT COUNT(*) INTO v_spot_count FROM spots WHERE user_id = v_user.user_id AND status = 'active';
    
    -- Create the 2nd machine (non-genesis)
    INSERT INTO spots (user_id, spot_name, status, is_genesis_spot, genesis_yields_remaining)
    VALUES (v_user.user_id, format('Machine %s', v_spot_count + 1), 'active', false, 0)
    RETURNING id INTO v_new_spot_id;
    
    -- Get next position
    SELECT COALESCE(MAX(position), 0) + 1 INTO v_new_position FROM drops;
    
    -- Create drop for the new spot
    INSERT INTO drops (spot_id, position, status, source_type, is_settled)
    VALUES (v_new_spot_id, v_new_position, 'waiting', 'new', true)
    RETURNING id INTO v_new_drop_id;
    
    -- Send notification about genesis completion and new machine
    INSERT INTO notifications (user_id, title, message, notification_type, link, metadata)
    VALUES (
      v_user.user_id,
      '🎉 Genesis Complete! New Machine Added!',
      format('Congratulations! You completed 3 Genesis Yields. Your Machine 2 is now active at Position #%s!', v_new_position),
      'genesis_complete',
      '/dashboard',
      json_build_object('spot_id', v_new_spot_id, 'position', v_new_position)
    );
    
    RAISE NOTICE 'Created 2nd machine for user % at position %', v_user.full_name, v_new_position;
  END LOOP;
END $$;