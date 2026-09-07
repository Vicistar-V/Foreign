-- ============================================
-- FIX: Restore distribute_liquidity() call in create_spot
-- This was missing, causing the entire queue to freeze!
-- ============================================

-- Update create_spot to call distribute_liquidity after creating drop
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
  -- CRITICAL: Distribute the liquidity NOW!
  -- This pours the ₦1,000 into other people's buckets
  -- ============================================
  SELECT distribute_liquidity(
    v_config.drop_entry_fee,  -- Amount to distribute (₦1,000)
    v_drop_id,                 -- Origin drop (don't fill your own bucket)
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

-- ============================================
-- KICKSTART: Process the 5 stuck drops (positions 120-124)
-- These have is_settled = false, meaning their ₦1,000 never flowed
-- ============================================
DO $$
DECLARE
  v_stuck_drop RECORD;
  v_result JSON;
BEGIN
  -- Find all unsettled drops and process them
  FOR v_stuck_drop IN 
    SELECT id, position 
    FROM drops 
    WHERE is_settled = false 
    ORDER BY position ASC
  LOOP
    -- Distribute the ₦1,000 from this stuck drop
    SELECT distribute_liquidity(1000, v_stuck_drop.id, 10) INTO v_result;
    
    -- Mark as settled
    UPDATE drops SET is_settled = true WHERE id = v_stuck_drop.id;
    
    RAISE NOTICE 'Processed stuck drop at position %: %', v_stuck_drop.position, v_result;
  END LOOP;
END $$;