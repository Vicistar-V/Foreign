-- Fix: Auto re-entry drops should be marked as unsettled so their ₦1,000 gets distributed
-- The bug was on line 138 where re-entry drops were created with is_settled = true

-- First, fix existing stuck re-entry drops that were never processed
UPDATE drops 
SET is_settled = false 
WHERE source_type = 're-entry' 
  AND status = 'waiting'
  AND fill_amount = 0
  AND is_settled = true;

-- Now recreate the process_drop_pulse function with the fix
CREATE OR REPLACE FUNCTION process_drop_pulse()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pulse_id UUID;
  v_pulse_number INTEGER;
  v_new_drops_processed INTEGER := 0;
  v_re_entries_processed INTEGER := 0;
  v_payouts_made INTEGER := 0;
  v_total_distributed NUMERIC := 0;
  v_config RECORD;
  v_unsettled_drop RECORD;
  v_target_drop RECORD;
  v_amount_to_distribute NUMERIC;
  v_amount_to_fill NUMERIC;
  v_overflow NUMERIC;
  v_spot RECORD;
  v_next_position INTEGER;
  v_referrer_id UUID;
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
  
  -- Process all unsettled drops (both new entries and re-entries)
  FOR v_unsettled_drop IN 
    SELECT d.*, s.user_id 
    FROM drops d
    JOIN spots s ON s.id = d.spot_id
    WHERE d.is_settled = false
    ORDER BY d.position ASC
  LOOP
    -- Each unsettled drop contributes its entry fee to the pool
    v_amount_to_distribute := v_config.drop_entry_fee;
    
    -- Track if this was a new drop or re-entry
    IF v_unsettled_drop.source_type = 'new' THEN
      v_new_drops_processed := v_new_drops_processed + 1;
    ELSE
      v_re_entries_processed := v_re_entries_processed + 1;
    END IF;
    
    -- Distribute to drops ahead in the queue (lower position numbers)
    WHILE v_amount_to_distribute > 0 LOOP
      -- Find the first drop that needs filling (not yet at target)
      SELECT d.*, s.user_id 
      INTO v_target_drop
      FROM drops d
      JOIN spots s ON s.id = d.spot_id
      WHERE d.status IN ('waiting', 'filling')
        AND d.fill_amount < d.target_amount
        AND d.position < v_unsettled_drop.position
      ORDER BY d.position ASC
      LIMIT 1;
      
      -- If no drop needs filling, stop distributing
      IF v_target_drop.id IS NULL THEN
        EXIT;
      END IF;
      
      -- Calculate how much this drop needs to be full
      v_amount_to_fill := v_target_drop.target_amount - v_target_drop.fill_amount;
      
      -- Take the minimum of what we have and what's needed
      IF v_amount_to_distribute >= v_amount_to_fill THEN
        v_overflow := v_amount_to_distribute - v_amount_to_fill;
        v_amount_to_distribute := v_amount_to_fill;
      ELSE
        v_overflow := 0;
      END IF;
      
      -- Update the target drop's fill amount
      UPDATE drops 
      SET 
        fill_amount = fill_amount + v_amount_to_distribute,
        status = CASE 
          WHEN fill_amount + v_amount_to_distribute >= target_amount THEN 'completed'
          ELSE 'filling'
        END,
        completed_at = CASE 
          WHEN fill_amount + v_amount_to_distribute >= target_amount THEN NOW()
          ELSE NULL
        END
      WHERE id = v_target_drop.id;
      
      v_total_distributed := v_total_distributed + v_amount_to_distribute;
      
      -- If drop is now complete, process payout
      IF v_target_drop.fill_amount + v_amount_to_distribute >= v_target_drop.target_amount THEN
        v_payouts_made := v_payouts_made + 1;
        
        -- Get the spot for this drop
        SELECT * INTO v_spot FROM spots WHERE id = v_target_drop.spot_id;
        
        -- Credit profit to user's earnings wallet
        INSERT INTO transactions (user_id, amount, transaction_type, wallet_type, description, status)
        VALUES (
          v_target_drop.user_id,
          v_config.drop_profit_amount,
          'drop_profit',
          'earnings',
          'Viketa Line profit - Cycle completed',
          'completed'
        );
        
        -- Update cached balance for earnings
        INSERT INTO cached_balances (user_id, earnings_balance, deposit_balance, last_updated)
        VALUES (v_target_drop.user_id, v_config.drop_profit_amount, 0, NOW())
        ON CONFLICT (user_id) DO UPDATE 
        SET earnings_balance = cached_balances.earnings_balance + v_config.drop_profit_amount,
            last_updated = NOW();
        
        -- Credit admin fee to system
        INSERT INTO transactions (user_id, amount, transaction_type, wallet_type, description, status)
        VALUES (
          v_target_drop.user_id,
          v_config.drop_admin_fee,
          'platform_fee',
          'system',
          'Viketa Line system fee',
          'completed'
        );
        
        -- Update spot stats
        UPDATE spots 
        SET 
          total_cycles = total_cycles + 1,
          total_earnings = total_earnings + v_config.drop_profit_amount
        WHERE id = v_target_drop.spot_id;
        
        -- Mark current drop as paid
        UPDATE drops 
        SET status = 'paid', paid_at = NOW()
        WHERE id = v_target_drop.id;
        
        -- Get next position for re-entry
        SELECT COALESCE(MAX(position), 0) + 1 INTO v_next_position FROM drops;
        
        -- Create re-entry drop at the back of the queue
        -- FIX: Set is_settled = false so re-entry gets processed in next pulse
        INSERT INTO drops (spot_id, position, fill_amount, target_amount, status, source_type, is_settled)
        VALUES (
          v_target_drop.spot_id,
          v_next_position,
          0,
          v_config.drop_target_amount,
          'waiting',
          're-entry',
          false  -- THIS IS THE FIX: was 'true' before, now 'false'
        );
        
        -- Create notification for user
        INSERT INTO notifications (user_id, title, message, notification_type, link)
        VALUES (
          v_target_drop.user_id,
          '💰 Payout Received!',
          'Your spot just completed a cycle! ₦' || v_config.drop_profit_amount || ' profit added to your earnings.',
          'payout',
          '/dashboard'
        );
        
        -- Check for referral bonus (first cycle only)
        IF v_spot.total_cycles = 0 THEN
          -- Get referrer
          SELECT p2.id INTO v_referrer_id
          FROM profiles p1
          JOIN profiles p2 ON p2.referral_code = p1.referred_by_code
          WHERE p1.id = v_target_drop.user_id
            AND p1.referred_by_code IS NOT NULL;
          
          IF v_referrer_id IS NOT NULL AND v_config.drop_referral_per_cycle > 0 THEN
            -- Credit referral bonus
            INSERT INTO transactions (user_id, amount, transaction_type, wallet_type, description, status)
            VALUES (
              v_referrer_id,
              v_config.drop_referral_per_cycle,
              'drop_referral_cycle',
              'earnings',
              'Referral bonus - Friend completed first cycle',
              'completed'
            );
            
            -- Update cached balance
            INSERT INTO cached_balances (user_id, earnings_balance, deposit_balance, last_updated)
            VALUES (v_referrer_id, v_config.drop_referral_per_cycle, 0, NOW())
            ON CONFLICT (user_id) DO UPDATE 
            SET earnings_balance = cached_balances.earnings_balance + v_config.drop_referral_per_cycle,
                last_updated = NOW();
          END IF;
        END IF;
      END IF;
      
      -- Continue with overflow if any
      v_amount_to_distribute := v_overflow;
    END LOOP;
    
    -- Mark this drop as settled
    UPDATE drops SET is_settled = true WHERE id = v_unsettled_drop.id;
  END LOOP;
  
  -- Update pulse record
  UPDATE drop_pulses
  SET 
    completed_at = NOW(),
    new_drops_processed = v_new_drops_processed,
    re_entries_processed = v_re_entries_processed,
    payouts_made = v_payouts_made,
    total_distributed = v_total_distributed,
    status = 'completed'
  WHERE id = v_pulse_id;
  
  RETURN json_build_object(
    'success', true,
    'pulse_number', v_pulse_number,
    'new_drops_processed', v_new_drops_processed,
    're_entries_processed', v_re_entries_processed,
    'payouts_made', v_payouts_made,
    'total_distributed', v_total_distributed
  );
END;
$$;