
-- ===========================================
-- TRUE HYBRID ARCHITECTURE: DUMB WRITER RPCs
-- These functions do ZERO logic, ZERO reading
-- They just receive values and INSERT/UPDATE
-- ===========================================

-- ==========================================
-- WRITE_TRANSACTION: Just insert a transaction
-- ==========================================
CREATE OR REPLACE FUNCTION public.write_transaction(
  _user_id UUID,
  _amount NUMERIC,
  _transaction_type transaction_type,
  _wallet_type wallet_type,
  _description TEXT,
  _status transaction_status DEFAULT 'completed',
  _metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_transaction_id UUID;
BEGIN
  INSERT INTO transactions (
    user_id, amount, transaction_type, wallet_type, description, status, metadata
  ) VALUES (
    _user_id, _amount, _transaction_type, _wallet_type, _description, _status, _metadata
  )
  RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$;

-- ==========================================
-- WRITE_DROP_FILL: Update drop fill status
-- ==========================================
CREATE OR REPLACE FUNCTION public.write_drop_fill(
  _drop_id UUID,
  _new_fill_amount NUMERIC,
  _new_status TEXT,
  _completed_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE drops 
  SET 
    fill_amount = _new_fill_amount,
    status = _new_status,
    completed_at = _completed_at
  WHERE id = _drop_id;
END;
$$;

-- ==========================================
-- WRITE_DROP_PAID: Mark drop as paid
-- ==========================================
CREATE OR REPLACE FUNCTION public.write_drop_paid(
  _drop_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE drops 
  SET status = 'paid', paid_at = NOW()
  WHERE id = _drop_id;
END;
$$;

-- ==========================================
-- WRITE_REENTRY_DROP: Create a new drop for re-entry
-- Position is PRE-CALCULATED by Edge Function
-- ==========================================
CREATE OR REPLACE FUNCTION public.write_reentry_drop(
  _spot_id UUID,
  _position INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_drop_id UUID;
BEGIN
  INSERT INTO drops (spot_id, position, status, source_type, is_settled)
  VALUES (_spot_id, _position, 'waiting', 're-entry', false)
  RETURNING id INTO v_drop_id;
  
  RETURN v_drop_id;
END;
$$;

-- ==========================================
-- WRITE_NEW_DROP: Create a new drop for spot purchase
-- Position is PRE-CALCULATED by Edge Function
-- ==========================================
CREATE OR REPLACE FUNCTION public.write_new_drop(
  _spot_id UUID,
  _position INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_drop_id UUID;
BEGIN
  INSERT INTO drops (spot_id, position, status, source_type, is_settled)
  VALUES (_spot_id, _position, 'waiting', 'new', true)
  RETURNING id INTO v_drop_id;
  
  RETURN v_drop_id;
END;
$$;

-- ==========================================
-- WRITE_NOTIFICATION: Just insert notification
-- ==========================================
CREATE OR REPLACE FUNCTION public.write_notification(
  _user_id UUID,
  _type TEXT,
  _title TEXT,
  _message TEXT,
  _metadata JSONB DEFAULT '{}',
  _link TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (
    user_id, notification_type, title, message, metadata, link
  ) VALUES (
    _user_id, _type, _title, _message, _metadata, _link
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- ==========================================
-- WRITE_PROFILE_UPDATE: Update profile fields
-- All values are PRE-CALCULATED by Edge Function
-- ==========================================
CREATE OR REPLACE FUNCTION public.write_profile_update(
  _user_id UUID,
  _set_first_cycle_completed_at BOOLEAN DEFAULT FALSE,
  _set_last_payout_at BOOLEAN DEFAULT FALSE,
  _total_recycled_profit_add NUMERIC DEFAULT 0,
  _set_genesis_completed_at BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE profiles 
  SET 
    first_cycle_completed_at = CASE 
      WHEN _set_first_cycle_completed_at THEN NOW() 
      ELSE first_cycle_completed_at 
    END,
    last_payout_at = CASE 
      WHEN _set_last_payout_at THEN NOW() 
      ELSE last_payout_at 
    END,
    total_recycled_profit = COALESCE(total_recycled_profit, 0) + _total_recycled_profit_add,
    genesis_completed_at = CASE 
      WHEN _set_genesis_completed_at THEN NOW() 
      ELSE genesis_completed_at 
    END
  WHERE id = _user_id;
END;
$$;

-- ==========================================
-- WRITE_SPOT: Create a new spot
-- ==========================================
CREATE OR REPLACE FUNCTION public.write_spot(
  _user_id UUID,
  _spot_name TEXT,
  _is_genesis_spot BOOLEAN DEFAULT FALSE,
  _genesis_yields_remaining INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_spot_id UUID;
BEGIN
  INSERT INTO spots (
    user_id, 
    spot_name, 
    status,
    is_genesis_spot,
    genesis_yields_remaining
  )
  VALUES (
    _user_id, 
    _spot_name, 
    'active',
    _is_genesis_spot,
    _genesis_yields_remaining
  )
  RETURNING id INTO v_spot_id;
  
  RETURN v_spot_id;
END;
$$;

-- ==========================================
-- WRITE_SPOT_STATS: Update spot statistics
-- Values are PRE-CALCULATED by Edge Function
-- ==========================================
CREATE OR REPLACE FUNCTION public.write_spot_stats(
  _spot_id UUID,
  _total_earnings_add NUMERIC,
  _cycles_add INTEGER DEFAULT 1,
  _genesis_yields_remaining_subtract INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE spots 
  SET 
    total_cycles = total_cycles + _cycles_add,
    total_earnings = total_earnings + _total_earnings_add,
    genesis_yields_remaining = GREATEST(0, genesis_yields_remaining - _genesis_yields_remaining_subtract)
  WHERE id = _spot_id;
END;
$$;

-- ==========================================
-- WRITE_DROP_SETTLED: Mark drop as settled
-- ==========================================
CREATE OR REPLACE FUNCTION public.write_drop_settled(
  _drop_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE drops 
  SET is_settled = TRUE
  WHERE id = _drop_id;
END;
$$;

-- ==========================================
-- COMMIT_DISTRIBUTION_BATCH: The ATOMIC wrapper
-- Receives a JSON payload with all writes
-- Executes everything in ONE transaction
-- If ANY write fails, EVERYTHING rolls back
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
  v_drop_paid UUID;
  v_drop_settled UUID;
  v_created_ids JSONB := '{"transactions": [], "notifications": [], "drops": [], "spots": []}'::JSONB;
  v_tx_id UUID;
  v_notif_id UUID;
  v_drop_id UUID;
  v_spot_id UUID;
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
-- HELPER: Get all data needed for distribution
-- Single query to fetch everything Edge Function needs
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
  
  -- Get unfilled drops with ALL related data in one query
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
      ) as referrer_id
    FROM drops d
    JOIN spots s ON s.id = d.spot_id
    JOIN profiles p ON p.id = s.user_id
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

-- ==========================================
-- HELPER: Get data for spot creation
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_spot_creation_data(
  _user_id UUID,
  _source_wallet wallet_type
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_config JSONB;
  v_profile JSONB;
  v_balance NUMERIC;
  v_spot_count INTEGER;
  v_max_position INTEGER;
BEGIN
  -- Get platform config
  SELECT jsonb_build_object(
    'drop_entry_fee', drop_entry_fee,
    'drop_target_amount', drop_target_amount,
    'drop_system_active', drop_system_active
  ) INTO v_config
  FROM platform_config WHERE id = 1;
  
  -- Get profile data
  SELECT jsonb_build_object(
    'id', id,
    'full_name', full_name,
    'is_member', is_member,
    'is_banned', is_banned,
    'phone_number', phone_number
  ) INTO v_profile
  FROM profiles WHERE id = _user_id;
  
  -- Get balance in source wallet
  SELECT check_balance(_user_id, _source_wallet) INTO v_balance;
  
  -- Count existing spots
  SELECT COUNT(*) INTO v_spot_count FROM spots WHERE user_id = _user_id;
  
  -- Get current max position
  SELECT COALESCE(MAX(position), 0) INTO v_max_position FROM drops;
  
  RETURN jsonb_build_object(
    'config', v_config,
    'profile', v_profile,
    'balance', v_balance,
    'spot_count', v_spot_count,
    'current_max_position', v_max_position
  );
END;
$$;

-- ==========================================
-- HELPER: Get unsettled reentries data
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_reentry_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_config JSONB;
  v_reentries JSONB;
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
  
  -- Get unsettled reentries
  SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
  INTO v_reentries
  FROM (
    SELECT 
      d.id as drop_id,
      d.position,
      s.id as spot_id,
      s.spot_name,
      s.user_id as owner_id
    FROM drops d
    JOIN spots s ON s.id = d.spot_id
    WHERE d.source_type = 're-entry'
      AND d.is_settled = false
    ORDER BY d.position ASC
  ) r;
  
  -- Get current max position
  SELECT COALESCE(MAX(position), 0) INTO v_max_position FROM drops;
  
  RETURN jsonb_build_object(
    'config', v_config,
    'reentries', v_reentries,
    'current_max_position', v_max_position
  );
END;
$$;
