-- ==========================================
-- GENESIS COMPLETION & AUTO-COMPOUND HANDLERS
-- Extends the Edge Function distribution system
-- ==========================================

-- ==========================================
-- HELPER: Process Genesis Completion
-- Called when a user completes 3 genesis cycles
-- Auto-buys second machine, transfers leftover to earnings
-- ==========================================
CREATE OR REPLACE FUNCTION public.process_genesis_completion(
  _user_id UUID,
  _genesis_spot_id UUID,
  _user_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_config platform_config;
  v_deposit_balance NUMERIC;
  v_leftover NUMERIC;
  v_spot_id UUID;
  v_drop_id UUID;
  v_spot_count INTEGER;
  v_next_machine_number INTEGER;
  v_next_position INTEGER;
BEGIN
  -- Get config
  SELECT * INTO v_config FROM platform_config WHERE id = 1;
  
  -- Get current deposit balance (already updated by earlier transactions in same batch)
  SELECT deposit_balance INTO v_deposit_balance 
  FROM cached_balances WHERE user_id = _user_id;
  
  -- If no cached balance exists, calculate from transactions
  IF v_deposit_balance IS NULL THEN
    SELECT COALESCE(SUM(
      CASE 
        WHEN amount > 0 THEN amount 
        ELSE amount 
      END
    ), 0) INTO v_deposit_balance
    FROM transactions 
    WHERE user_id = _user_id 
      AND wallet_type = 'deposit' 
      AND status = 'completed';
  END IF;
  
  -- Check if enough to buy machine
  IF v_deposit_balance < v_config.drop_entry_fee THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient deposit balance for genesis auto-buy',
      'deposit_balance', v_deposit_balance,
      'required', v_config.drop_entry_fee
    );
  END IF;
  
  -- Determine machine number
  SELECT COUNT(*) INTO v_spot_count FROM spots WHERE user_id = _user_id;
  v_next_machine_number := v_spot_count + 1;
  
  -- Get next drop position
  SELECT COALESCE(MAX(position), 0) + 1 INTO v_next_position FROM drops;
  
  -- STEP 1: Deduct machine cost from deposit
  INSERT INTO transactions (
    user_id, amount, transaction_type, wallet_type, description, status, metadata
  ) VALUES (
    _user_id,
    -v_config.drop_entry_fee,
    'drop_entry',
    'deposit',
    format('Machine %s (Genesis auto-buy)', v_next_machine_number),
    'completed',
    jsonb_build_object('genesis_auto_buy', true, 'genesis_spot_id', _genesis_spot_id)
  );
  
  -- STEP 2: Create the new spot (NOT a genesis spot)
  INSERT INTO spots (user_id, spot_name, is_genesis_spot, genesis_yields_remaining)
  VALUES (_user_id, format('Machine %s', v_next_machine_number), false, 0)
  RETURNING id INTO v_spot_id;
  
  -- STEP 3: Create its first drop in queue
  INSERT INTO drops (spot_id, position, source_type)
  VALUES (v_spot_id, v_next_position, 'new')
  RETURNING id INTO v_drop_id;
  
  -- STEP 4: Calculate and transfer leftover to earnings
  v_leftover := v_deposit_balance - v_config.drop_entry_fee;
  
  IF v_leftover > 0 THEN
    -- Deduct from deposit
    INSERT INTO transactions (
      user_id, amount, transaction_type, wallet_type, description, status, metadata
    ) VALUES (
      _user_id, 
      -v_leftover, 
      'genesis_transfer', 
      'deposit',
      'Genesis complete - moving bonus to earnings', 
      'completed',
      jsonb_build_object('transfer_to', 'earnings')
    );
    
    -- Add to earnings (withdrawable!)
    INSERT INTO transactions (
      user_id, amount, transaction_type, wallet_type, description, status, metadata
    ) VALUES (
      _user_id, 
      v_leftover, 
      'genesis_transfer', 
      'earnings',
      format('₦%s Genesis bonus ready to withdraw!', v_leftover::INTEGER), 
      'completed',
      jsonb_build_object('transfer_from', 'deposit', 'genesis_bonus', true)
    );
    
    -- Notification about bonus
    INSERT INTO notifications (user_id, notification_type, title, message, metadata)
    VALUES (
      _user_id,
      'genesis_bonus',
      format('₦%s Bonus Unlocked!', v_leftover::INTEGER),
      'Your extra genesis earnings are now ready to withdraw!',
      jsonb_build_object('amount', v_leftover)
    );
  END IF;
  
  -- STEP 5: Update cached balance
  UPDATE cached_balances 
  SET deposit_balance = 0,
      earnings_balance = earnings_balance + v_leftover,
      last_updated = now()
  WHERE user_id = _user_id;
  
  -- If no cached balance row, create one
  IF NOT FOUND THEN
    INSERT INTO cached_balances (user_id, deposit_balance, earnings_balance)
    VALUES (_user_id, 0, v_leftover)
    ON CONFLICT (user_id) DO UPDATE SET
      deposit_balance = 0,
      earnings_balance = cached_balances.earnings_balance + v_leftover,
      last_updated = now();
  END IF;
  
  -- STEP 6: Send success notification
  INSERT INTO notifications (user_id, notification_type, title, message, metadata)
  VALUES (
    _user_id,
    'genesis_complete',
    '🎉 GENESIS COMPLETE! Machine 2 is LIVE!',
    format('Your first 3 payouts built Machine %s automatically! You now have 2 machines earning for you.', v_next_machine_number),
    jsonb_build_object(
      'new_spot_id', v_spot_id,
      'new_drop_id', v_drop_id,
      'machine_number', v_next_machine_number,
      'leftover_transferred', v_leftover
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'new_spot_id', v_spot_id,
    'new_drop_id', v_drop_id,
    'machine_number', v_next_machine_number,
    'leftover_transferred', v_leftover,
    'new_drop_position', v_next_position
  );
END;
$$;

-- ==========================================
-- HELPER: Process Auto-Compound
-- Called when Empire Builder user has enough earnings
-- Auto-buys machines from earnings wallet
-- ==========================================
CREATE OR REPLACE FUNCTION public.process_auto_compound(
  _user_id UUID,
  _user_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_config platform_config;
  v_earnings_balance NUMERIC;
  v_spot_count INTEGER;
  v_next_machine_number INTEGER;
  v_spot_id UUID;
  v_drop_id UUID;
  v_machines_bought INTEGER := 0;
  v_next_position INTEGER;
  v_bought_machines JSONB := '[]'::JSONB;
BEGIN
  -- Get config
  SELECT * INTO v_config FROM platform_config WHERE id = 1;
  
  -- Get current earnings balance
  SELECT earnings_balance INTO v_earnings_balance 
  FROM cached_balances WHERE user_id = _user_id;
  
  -- If no cached balance exists, calculate from transactions
  IF v_earnings_balance IS NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_earnings_balance
    FROM transactions 
    WHERE user_id = _user_id 
      AND wallet_type = 'earnings' 
      AND status = 'completed';
  END IF;
  
  -- Buy machines while we have enough
  WHILE v_earnings_balance >= v_config.drop_entry_fee LOOP
    -- Determine machine number
    SELECT COUNT(*) INTO v_spot_count FROM spots WHERE user_id = _user_id;
    v_next_machine_number := v_spot_count + 1;
    
    -- Get next drop position
    SELECT COALESCE(MAX(position), 0) + 1 INTO v_next_position FROM drops;
    
    -- Deduct from earnings
    INSERT INTO transactions (
      user_id, amount, transaction_type, wallet_type, description, status, metadata
    ) VALUES (
      _user_id,
      -v_config.drop_entry_fee,
      'drop_entry',
      'earnings',
      format('Machine %s (Empire Builder)', v_next_machine_number),
      'completed',
      jsonb_build_object('auto_compound', true)
    );
    
    -- Create the new spot
    INSERT INTO spots (user_id, spot_name, is_genesis_spot, genesis_yields_remaining)
    VALUES (_user_id, format('Machine %s', v_next_machine_number), false, 0)
    RETURNING id INTO v_spot_id;
    
    -- Create its first drop in queue
    INSERT INTO drops (spot_id, position, source_type)
    VALUES (v_spot_id, v_next_position, 'new')
    RETURNING id INTO v_drop_id;
    
    v_machines_bought := v_machines_bought + 1;
    v_earnings_balance := v_earnings_balance - v_config.drop_entry_fee;
    
    -- Track bought machines
    v_bought_machines := v_bought_machines || jsonb_build_object(
      'spot_id', v_spot_id,
      'drop_id', v_drop_id,
      'machine_number', v_next_machine_number,
      'position', v_next_position
    );
    
    -- Update cached balance for each machine
    UPDATE cached_balances 
    SET earnings_balance = v_earnings_balance, 
        last_updated = now()
    WHERE user_id = _user_id;
  END LOOP;
  
  -- Send single notification for all machines bought
  IF v_machines_bought > 0 THEN
    INSERT INTO notifications (user_id, notification_type, title, message, metadata)
    VALUES (
      _user_id,
      'auto_compound_purchase',
      CASE WHEN v_machines_bought = 1 
        THEN '🚀 Empire Builder bought you a new machine!'
        ELSE format('🚀 Empire Builder bought you %s new machines!', v_machines_bought)
      END,
      CASE WHEN v_machines_bought = 1
        THEN format('Your profits hit ₦%s, so Machine %s was bought automatically!', v_config.drop_entry_fee::INTEGER, v_next_machine_number)
        ELSE format('Your profits are compounding! You now have %s machines in total.', v_spot_count + v_machines_bought)
      END,
      jsonb_build_object(
        'machines_bought', v_machines_bought,
        'machines', v_bought_machines,
        'remaining_earnings', v_earnings_balance
      )
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'machines_bought', v_machines_bought,
    'machines', v_bought_machines,
    'remaining_earnings', v_earnings_balance
  );
END;
$$;

-- ==========================================
-- UPDATE: commit_distribution_batch to handle genesis and auto-compound
-- ==========================================
CREATE OR REPLACE FUNCTION public.commit_distribution_batch(
  _writes JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tx JSONB;
  v_drop_fill JSONB;
  v_notification JSONB;
  v_profile_update JSONB;
  v_spot_stat JSONB;
  v_reentry JSONB;
  v_new_drop JSONB;
  v_new_spot JSONB;
  v_genesis JSONB;
  v_compound JSONB;
  v_drop_paid UUID;
  v_drop_settled UUID;
  v_created_ids JSONB := '{"transactions": [], "notifications": [], "drops": [], "spots": [], "genesis_results": [], "compound_results": []}'::JSONB;
  v_tx_id UUID;
  v_notif_id UUID;
  v_drop_id UUID;
  v_spot_id UUID;
  v_genesis_result JSONB;
  v_compound_result JSONB;
BEGIN
  -- Process transactions
  IF _writes ? 'transactions' THEN
    FOR v_tx IN SELECT * FROM jsonb_array_elements(_writes->'transactions')
    LOOP
      SELECT write_transaction(
        (v_tx->>'user_id')::UUID,
        (v_tx->>'amount')::NUMERIC,
        (v_tx->>'transaction_type')::transaction_type,
        (v_tx->>'wallet_type')::wallet_type,
        v_tx->>'description',
        COALESCE((v_tx->>'status')::transaction_status, 'completed'),
        COALESCE(v_tx->'metadata', '{}')
      ) INTO v_tx_id;
      
      v_created_ids := jsonb_set(v_created_ids, '{transactions}', v_created_ids->'transactions' || jsonb_build_array(v_tx_id));
    END LOOP;
  END IF;
  
  -- Process drop fills
  IF _writes ? 'drop_fills' THEN
    FOR v_drop_fill IN SELECT * FROM jsonb_array_elements(_writes->'drop_fills')
    LOOP
      PERFORM write_drop_fill(
        (v_drop_fill->>'drop_id')::UUID,
        (v_drop_fill->>'new_fill_amount')::NUMERIC,
        v_drop_fill->>'new_status',
        NULLIF(v_drop_fill->>'completed_at', '')::TIMESTAMPTZ
      );
    END LOOP;
  END IF;
  
  -- Process drop paids
  IF _writes ? 'drop_paids' THEN
    FOR v_drop_paid IN SELECT * FROM jsonb_array_elements_text(_writes->'drop_paids')
    LOOP
      PERFORM write_drop_paid(v_drop_paid);
    END LOOP;
  END IF;
  
  -- Process drop settleds
  IF _writes ? 'drop_settleds' THEN
    FOR v_drop_settled IN SELECT * FROM jsonb_array_elements_text(_writes->'drop_settleds')
    LOOP
      PERFORM write_drop_settled(v_drop_settled);
    END LOOP;
  END IF;
  
  -- Process new spots
  IF _writes ? 'new_spots' THEN
    FOR v_new_spot IN SELECT * FROM jsonb_array_elements(_writes->'new_spots')
    LOOP
      SELECT write_spot(
        (v_new_spot->>'user_id')::UUID,
        v_new_spot->>'spot_name',
        COALESCE((v_new_spot->>'is_genesis_spot')::BOOLEAN, false),
        COALESCE((v_new_spot->>'genesis_yields_remaining')::INTEGER, 0)
      ) INTO v_spot_id;
      
      v_created_ids := jsonb_set(v_created_ids, '{spots}', v_created_ids->'spots' || jsonb_build_array(jsonb_build_object('id', v_spot_id, 'key', v_new_spot->>'key')));
    END LOOP;
  END IF;
  
  -- Process new drops
  IF _writes ? 'new_drops' THEN
    FOR v_new_drop IN SELECT * FROM jsonb_array_elements(_writes->'new_drops')
    LOOP
      SELECT write_new_drop(
        (v_new_drop->>'spot_id')::UUID,
        (v_new_drop->>'position')::INTEGER
      ) INTO v_drop_id;
      
      v_created_ids := jsonb_set(v_created_ids, '{drops}', v_created_ids->'drops' || jsonb_build_array(jsonb_build_object('id', v_drop_id, 'key', v_new_drop->>'key')));
    END LOOP;
  END IF;
  
  -- Process reentry drops
  IF _writes ? 'reentry_drops' THEN
    FOR v_reentry IN SELECT * FROM jsonb_array_elements(_writes->'reentry_drops')
    LOOP
      SELECT write_reentry_drop(
        (v_reentry->>'spot_id')::UUID,
        (v_reentry->>'position')::INTEGER
      ) INTO v_drop_id;
      
      v_created_ids := jsonb_set(v_created_ids, '{drops}', v_created_ids->'drops' || jsonb_build_array(v_drop_id));
    END LOOP;
  END IF;
  
  -- Process notifications
  IF _writes ? 'notifications' THEN
    FOR v_notification IN SELECT * FROM jsonb_array_elements(_writes->'notifications')
    LOOP
      SELECT write_notification(
        (v_notification->>'user_id')::UUID,
        v_notification->>'type',
        v_notification->>'title',
        v_notification->>'message',
        COALESCE(v_notification->'metadata', '{}'),
        v_notification->>'link'
      ) INTO v_notif_id;
      
      v_created_ids := jsonb_set(v_created_ids, '{notifications}', v_created_ids->'notifications' || jsonb_build_array(v_notif_id));
    END LOOP;
  END IF;
  
  -- Process profile updates
  IF _writes ? 'profile_updates' THEN
    FOR v_profile_update IN SELECT * FROM jsonb_array_elements(_writes->'profile_updates')
    LOOP
      PERFORM write_profile_update(
        (v_profile_update->>'user_id')::UUID,
        COALESCE((v_profile_update->>'set_first_cycle_completed_at')::BOOLEAN, false),
        COALESCE((v_profile_update->>'set_last_payout_at')::BOOLEAN, false),
        COALESCE((v_profile_update->>'total_recycled_profit_add')::NUMERIC, 0),
        COALESCE((v_profile_update->>'set_genesis_completed_at')::BOOLEAN, false)
      );
    END LOOP;
  END IF;
  
  -- Process spot stats updates
  IF _writes ? 'spot_stats' THEN
    FOR v_spot_stat IN SELECT * FROM jsonb_array_elements(_writes->'spot_stats')
    LOOP
      PERFORM write_spot_stats(
        (v_spot_stat->>'spot_id')::UUID,
        (v_spot_stat->>'total_earnings_add')::NUMERIC,
        COALESCE((v_spot_stat->>'cycles_add')::INTEGER, 1),
        COALESCE((v_spot_stat->>'genesis_yields_remaining_subtract')::INTEGER, 0)
      );
    END LOOP;
  END IF;
  
  -- ==========================================
  -- NEW: Process genesis completions
  -- Must happen after transactions to get updated balances
  -- ==========================================
  IF _writes ? 'genesis_completions' THEN
    FOR v_genesis IN SELECT * FROM jsonb_array_elements(_writes->'genesis_completions')
    LOOP
      -- Refresh the user's cached balance first
      PERFORM refresh_user_cache((v_genesis->>'user_id')::UUID);
      
      -- Process the genesis completion
      SELECT process_genesis_completion(
        (v_genesis->>'user_id')::UUID,
        (v_genesis->>'genesis_spot_id')::UUID,
        v_genesis->>'user_name'
      ) INTO v_genesis_result;
      
      v_created_ids := jsonb_set(
        v_created_ids, 
        '{genesis_results}', 
        v_created_ids->'genesis_results' || jsonb_build_array(v_genesis_result)
      );
    END LOOP;
  END IF;
  
  -- ==========================================
  -- NEW: Process auto-compound triggers
  -- Must happen after transactions to get updated balances
  -- ==========================================
  IF _writes ? 'auto_compound_triggers' THEN
    FOR v_compound IN SELECT * FROM jsonb_array_elements(_writes->'auto_compound_triggers')
    LOOP
      -- Refresh the user's cached balance first
      PERFORM refresh_user_cache((v_compound->>'user_id')::UUID);
      
      -- Process the auto-compound
      SELECT process_auto_compound(
        (v_compound->>'user_id')::UUID,
        v_compound->>'user_name'
      ) INTO v_compound_result;
      
      v_created_ids := jsonb_set(
        v_created_ids, 
        '{compound_results}', 
        v_created_ids->'compound_results' || jsonb_build_array(v_compound_result)
      );
    END LOOP;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'created_ids', v_created_ids
  );
EXCEPTION WHEN OTHERS THEN
  -- This will cause the entire transaction to rollback
  RAISE;
END;
$$;

-- ==========================================
-- UPDATE: get_distribution_data to include balances
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_distribution_data(
  _origin_drop_id UUID,
  _max_drops INTEGER DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_config JSONB;
  v_drops JSONB;
  v_max_position INTEGER;
BEGIN
  -- Get platform config
  SELECT jsonb_build_object(
    'drop_entry_fee', drop_entry_fee,
    'drop_target_amount', drop_target_amount,
    'drop_profit_amount', drop_profit_amount,
    'drop_profit_amount_subsequent', drop_profit_amount_subsequent,
    'drop_admin_fee', drop_admin_fee,
    'drop_referral_per_cycle', drop_referral_per_cycle,
    'drop_reentry_amount', drop_reentry_amount,
    'drop_system_active', drop_system_active,
    'velocity_tier_enabled', velocity_tier_enabled,
    'velocity_tier_referral_requirement', velocity_tier_referral_requirement,
    'velocity_tier_cooldown_hours', velocity_tier_cooldown_hours
  ) INTO v_config
  FROM platform_config WHERE id = 1;
  
  -- Get unfilled drops with ALL related data in one query (including balances)
  SELECT COALESCE(jsonb_agg(row_to_json(d)::jsonb), '[]')
  INTO v_drops
  FROM (
    SELECT 
      d.id as drop_id,
      d.fill_amount,
      d.target_amount,
      d.position,
      d.status,
      s.id as spot_id,
      s.user_id as owner_id,
      s.spot_name,
      s.is_genesis_spot,
      s.genesis_yields_remaining,
      p.full_name as owner_name,
      p.auto_compound_enabled,
      p.referred_by_code,
      p.referral_code,
      p.first_cycle_completed_at,
      p.last_payout_at,
      p.total_recycled_profit,
      -- Count active referrals for velocity tier
      (
        SELECT COUNT(*) 
        FROM profiles ref 
        WHERE ref.referred_by_code = p.referral_code 
          AND ref.is_member = true
      ) as active_referrals_count,
      -- Get referrer ID if exists
      (
        SELECT id 
        FROM profiles 
        WHERE referral_code = p.referred_by_code
        LIMIT 1
      ) as referrer_id,
      -- NEW: Include current balances for genesis/auto-compound calculations
      COALESCE(cb.deposit_balance, 0) as deposit_balance,
      COALESCE(cb.earnings_balance, 0) as earnings_balance
    FROM drops d
    JOIN spots s ON s.id = d.spot_id
    JOIN profiles p ON p.id = s.user_id
    LEFT JOIN cached_balances cb ON cb.user_id = s.user_id
    WHERE d.id != _origin_drop_id
      AND d.status IN ('waiting', 'filling')
      AND d.fill_amount < d.target_amount
    ORDER BY d.position ASC
    LIMIT _max_drops
  ) d;
  
  -- Get current max position for reentries
  SELECT COALESCE(MAX(position), 0) INTO v_max_position FROM drops;
  
  RETURN jsonb_build_object(
    'config', v_config,
    'drops', v_drops,
    'current_max_position', v_max_position
  );
END;
$$;

-- Add documentation comments
COMMENT ON FUNCTION public.process_genesis_completion IS 'Handles genesis completion: auto-buys Machine 2 from deposit wallet and transfers remaining balance to earnings wallet for withdrawal.';
COMMENT ON FUNCTION public.process_auto_compound IS 'Empire Builder feature: automatically buys new machines when user earnings reach ₦1,000. Buys as many machines as possible from current earnings.';