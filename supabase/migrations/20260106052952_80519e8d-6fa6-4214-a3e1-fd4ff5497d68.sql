-- ============================================
-- HYBRID HEARTBEAT ARCHITECTURE MIGRATION
-- Instant liquidity flow + batched re-entries
-- ============================================

-- ============================================
-- STEP 1: Add pending_redrop status to spots
-- ============================================
ALTER TABLE public.spots 
DROP CONSTRAINT IF EXISTS spots_status_check;

ALTER TABLE public.spots 
ADD CONSTRAINT spots_status_check 
CHECK (status IN ('active', 'paused', 'closed', 'pending_redrop'));

-- ============================================
-- STEP 2: Add pending_redrop status to drops
-- ============================================
ALTER TABLE public.drops 
DROP CONSTRAINT IF EXISTS drops_status_check;

ALTER TABLE public.drops 
ADD CONSTRAINT drops_status_check 
CHECK (status IN ('waiting', 'filling', 'completed', 'paid', 're-entered', 'pending_redrop'));

-- ============================================
-- STEP 3: Create distribute_liquidity function
-- This is the HEART of the Hybrid Heartbeat
-- Called instantly on new entries
-- ============================================
CREATE OR REPLACE FUNCTION public.distribute_liquidity(
  _amount NUMERIC,
  _origin_drop_id UUID,
  _max_depth INTEGER DEFAULT 5
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_remaining NUMERIC := _amount;
  v_depth INTEGER := 0;
  v_payouts_made INTEGER := 0;
  v_total_distributed NUMERIC := 0;
  v_target_drop RECORD;
  v_amount_to_pour NUMERIC;
  v_overflow NUMERIC;
  v_spot RECORD;
  v_config RECORD;
  v_referrer_id UUID;
  v_referrer_name TEXT;
  v_user_name TEXT;
  v_actual_admin_fee NUMERIC;
  v_new_position INTEGER;
BEGIN
  -- Get platform config
  SELECT * INTO v_config FROM platform_config WHERE id = 1;
  
  -- Distribution loop
  WHILE v_remaining > 0 AND v_depth < _max_depth LOOP
    -- Find the oldest drop that needs filling (not our own origin drop)
    SELECT d.*, s.user_id 
    INTO v_target_drop
    FROM drops d
    JOIN spots s ON s.id = d.spot_id
    WHERE d.status IN ('waiting', 'filling')
      AND d.fill_amount < d.target_amount
      AND d.id != _origin_drop_id
    ORDER BY d.position ASC
    LIMIT 1;
    
    -- Exit if no drop needs filling
    IF v_target_drop.id IS NULL THEN
      EXIT;
    END IF;
    
    -- Calculate how much this drop needs
    v_amount_to_pour := LEAST(v_remaining, v_target_drop.target_amount - v_target_drop.fill_amount);
    v_overflow := v_remaining - v_amount_to_pour;
    
    -- Update the target drop's fill amount
    UPDATE drops 
    SET 
      fill_amount = fill_amount + v_amount_to_pour,
      status = CASE 
        WHEN fill_amount + v_amount_to_pour >= target_amount THEN 'completed'
        ELSE 'filling'
      END,
      completed_at = CASE 
        WHEN fill_amount + v_amount_to_pour >= target_amount THEN NOW()
        ELSE completed_at
      END
    WHERE id = v_target_drop.id;
    
    v_total_distributed := v_total_distributed + v_amount_to_pour;
    
    -- If drop is now complete, process INSTANT payout
    IF v_target_drop.fill_amount + v_amount_to_pour >= v_target_drop.target_amount THEN
      v_payouts_made := v_payouts_made + 1;
      v_depth := v_depth + 1;
      
      -- Get the spot and user info
      SELECT * INTO v_spot FROM spots WHERE id = v_target_drop.spot_id;
      SELECT full_name INTO v_user_name FROM profiles WHERE id = v_target_drop.user_id;
      
      -- Check for referrer (for EVERY cycle royalty)
      SELECT p2.id, p2.full_name 
      INTO v_referrer_id, v_referrer_name
      FROM profiles p1
      JOIN profiles p2 ON p2.referral_code = p1.referred_by_code
      WHERE p1.id = v_target_drop.user_id
        AND p1.referred_by_code IS NOT NULL
        AND p1.referred_by_code != 'SYSTEM';
      
      -- Calculate admin fee (reduced if referrer exists)
      IF v_referrer_id IS NOT NULL AND v_config.drop_referral_per_cycle > 0 THEN
        v_actual_admin_fee := v_config.drop_admin_fee - v_config.drop_referral_per_cycle;
      ELSE
        v_actual_admin_fee := v_config.drop_admin_fee;
      END IF;
      
      -- INSTANT: Credit profit to user's earnings wallet
      INSERT INTO transactions (user_id, amount, transaction_type, wallet_type, description, status, metadata)
      VALUES (
        v_target_drop.user_id,
        v_config.drop_profit_amount,
        'drop_profit',
        'earnings',
        'Viketa Line profit - Cycle completed',
        'completed',
        json_build_object('spot_id', v_target_drop.spot_id, 'drop_id', v_target_drop.id, 'cycle', v_spot.total_cycles + 1)
      );
      
      -- Update cached balance for user earnings
      INSERT INTO cached_balances (user_id, earnings_balance, deposit_balance, last_updated)
      VALUES (v_target_drop.user_id, v_config.drop_profit_amount, 0, NOW())
      ON CONFLICT (user_id) DO UPDATE 
      SET earnings_balance = cached_balances.earnings_balance + v_config.drop_profit_amount,
          last_updated = NOW();
      
      -- Credit admin fee to system
      INSERT INTO transactions (user_id, amount, transaction_type, wallet_type, description, status, metadata)
      VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_actual_admin_fee,
        'platform_fee',
        'system',
        CASE 
          WHEN v_referrer_id IS NOT NULL THEN 'Viketa Line system fee (after referral royalty)'
          ELSE 'Viketa Line system fee'
        END,
        'completed',
        json_build_object('from_user_id', v_target_drop.user_id, 'drop_id', v_target_drop.id)
      );
      
      -- INSTANT: Pay referral royalty if referrer exists
      IF v_referrer_id IS NOT NULL AND v_config.drop_referral_per_cycle > 0 THEN
        INSERT INTO transactions (user_id, amount, transaction_type, wallet_type, description, status, metadata)
        VALUES (
          v_referrer_id,
          v_config.drop_referral_per_cycle,
          'drop_referral_cycle',
          'earnings',
          format('Referral royalty - %s completed a cycle', v_user_name),
          'completed',
          json_build_object('referee_id', v_target_drop.user_id::text, 'referee_name', v_user_name, 'cycle_number', v_spot.total_cycles + 1)
        );
        
        -- Update referrer's cached balance
        INSERT INTO cached_balances (user_id, earnings_balance, deposit_balance, last_updated)
        VALUES (v_referrer_id, v_config.drop_referral_per_cycle, 0, NOW())
        ON CONFLICT (user_id) DO UPDATE 
        SET earnings_balance = cached_balances.earnings_balance + v_config.drop_referral_per_cycle,
            last_updated = NOW();
        
        -- INSTANT: Notify referrer about the royalty
        INSERT INTO notifications (user_id, title, message, notification_type, link, metadata)
        VALUES (
          v_referrer_id,
          'Referral Royalty!',
          format('You earned ₦%s from %s completing a cycle', v_config.drop_referral_per_cycle, v_user_name),
          'referral_bonus',
          '/invite',
          json_build_object('referee_name', v_user_name, 'amount', v_config.drop_referral_per_cycle)
        );
      END IF;
      
      -- Update spot stats
      UPDATE spots 
      SET 
        total_cycles = total_cycles + 1,
        total_earnings = total_earnings + v_config.drop_profit_amount,
        status = 'pending_redrop'  -- Mark for re-entry by the pulse
      WHERE id = v_target_drop.spot_id;
      
      -- Mark drop as pending redrop (NOT paid yet - waiting for pulse to re-enter)
      UPDATE drops 
      SET 
        status = 'pending_redrop', 
        paid_at = NOW()
      WHERE id = v_target_drop.id;
      
      -- INSTANT: Create notification for user about their payout
      INSERT INTO notifications (user_id, title, message, notification_type, link, metadata)
      VALUES (
        v_target_drop.user_id,
        'Payout Received!',
        format('Your %s just completed a cycle! ₦%s profit added to your earnings.', v_spot.spot_name, v_config.drop_profit_amount),
        'payout',
        '/dashboard',
        json_build_object('spot_name', v_spot.spot_name, 'profit', v_config.drop_profit_amount, 'cycle', v_spot.total_cycles + 1)
      );
    END IF;
    
    -- Continue with overflow
    v_remaining := v_overflow;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'distributed', v_total_distributed,
    'payouts_made', v_payouts_made,
    'remaining', v_remaining,
    'depth_reached', v_depth
  );
END;
$function$;

-- ============================================
-- STEP 4: Update create_spot function
-- Now calls distribute_liquidity immediately
-- ============================================
CREATE OR REPLACE FUNCTION public.create_spot(_user_id uuid, _source_wallet wallet_type DEFAULT 'deposit'::wallet_type)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _balance DECIMAL;
  _config RECORD;
  _spot_id UUID;
  _drop_id UUID;
  _position INTEGER;
  _spot_count INTEGER;
  _spot_name TEXT;
  _distribution_result JSON;
BEGIN
  -- Get platform config
  SELECT drop_entry_fee, drop_target_amount, drop_system_active 
  INTO _config 
  FROM platform_config WHERE id = 1;

  -- Check if drop system is active
  IF NOT _config.drop_system_active THEN
    RETURN json_build_object('success', false, 'error', 'The Viketa Line is currently paused');
  END IF;

  -- Check user's balance in source wallet
  SELECT COALESCE(SUM(amount), 0) INTO _balance
  FROM transactions
  WHERE user_id = _user_id 
    AND wallet_type = _source_wallet 
    AND status = 'completed';

  IF _balance < _config.drop_entry_fee THEN
    RETURN json_build_object(
      'success', false, 
      'error', format('Not enough money. You need ₦%s but have ₦%s', _config.drop_entry_fee, _balance)
    );
  END IF;

  -- Count existing spots for naming
  SELECT COUNT(*) + 1 INTO _spot_count FROM spots WHERE user_id = _user_id;
  _spot_name := 'Spot ' || _spot_count;

  -- Get next position in the queue
  SELECT get_next_drop_position() INTO _position;

  -- Deduct from user's wallet
  INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES (
    _user_id, 
    _source_wallet, 
    -_config.drop_entry_fee, 
    'drop_entry', 
    format('Bought %s - Position #%s in The Line', _spot_name, _position),
    'completed',
    json_build_object('spot_name', _spot_name, 'position', _position)
  );

  -- Credit system treasury
  INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    'earnings',
    _config.drop_entry_fee,
    'drop_entry',
    format('Spot purchase by user - Position #%s', _position),
    'completed',
    json_build_object('buyer_id', _user_id::text, 'position', _position)
  );

  -- Create the spot
  INSERT INTO spots (user_id, spot_name, status)
  VALUES (_user_id, _spot_name, 'active')
  RETURNING id INTO _spot_id;

  -- Create the drop (entry in the queue) - MARKED AS SETTLED since we process immediately
  INSERT INTO drops (spot_id, position, fill_amount, target_amount, status, source_type, is_settled)
  VALUES (_spot_id, _position, 0, _config.drop_target_amount, 'waiting', 'new', true)
  RETURNING id INTO _drop_id;

  -- Create notification
  INSERT INTO notifications (user_id, notification_type, title, message, metadata, link)
  VALUES (
    _user_id,
    'drop_joined',
    'You Joined The Line!',
    format('Your %s is now at Position #%s. Waiting for people to join behind you...', _spot_name, _position),
    json_build_object('spot_id', _spot_id::text, 'position', _position),
    '/dashboard'
  );

  -- ========================================
  -- INSTANT LIQUIDITY DISTRIBUTION
  -- This is the Hybrid Heartbeat in action!
  -- ========================================
  SELECT distribute_liquidity(_config.drop_entry_fee, _drop_id, 5) INTO _distribution_result;

  RETURN json_build_object(
    'success', true,
    'spot_id', _spot_id,
    'drop_id', _drop_id,
    'spot_name', _spot_name,
    'position', _position,
    'message', format('You are now Position #%s in The Viketa Line!', _position),
    'instant_distribution', _distribution_result
  );
END;
$function$;

-- ============================================
-- STEP 5: Create process_reentry_pulse function
-- Only handles re-entries from pending_redrop spots
-- ============================================
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
    
    -- INSTANT: Distribute this re-entry's liquidity
    SELECT distribute_liquidity(v_config.drop_reentry_amount, v_new_drop_id, 5) INTO v_distribution_result;
    
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
    new_drops_processed = 0,  -- This pulse only handles re-entries
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

-- ============================================
-- STEP 6: Keep old process_drop_pulse as alias
-- For backward compatibility during transition
-- ============================================
CREATE OR REPLACE FUNCTION public.process_drop_pulse()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Redirect to the new reentry pulse function
  RETURN process_reentry_pulse();
END;
$function$;