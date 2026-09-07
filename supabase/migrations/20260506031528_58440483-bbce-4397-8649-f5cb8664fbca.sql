-- 1. get_distribution_data: drop genesis fields
CREATE OR REPLACE FUNCTION public.get_distribution_data(_origin_drop_id uuid, _max_drops integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_config JSONB;
  v_drops JSONB;
  v_max_position INTEGER;
BEGIN
  SELECT jsonb_build_object(
    'drop_entry_fee', drop_entry_fee,
    'drop_target_amount', drop_target_amount,
    'drop_profit_amount', drop_profit_amount,
    'drop_profit_amount_subsequent', drop_profit_amount_subsequent,
    'drop_admin_fee', drop_admin_fee,
    'drop_referral_per_cycle', drop_referral_per_cycle,
    'drop_reentry_amount', drop_reentry_amount,
    'drop_system_active', drop_system_active,
    'distribution_active', distribution_active
  ) INTO v_config
  FROM platform_config WHERE id = 1;

  SELECT COALESCE(jsonb_agg(row_to_json(d)::jsonb), '[]')
  INTO v_drops
  FROM (
    SELECT
      d.id as drop_id,
      d.fill_amount,
      d.target_amount,
      d.position,
      d.status,
      d.source_type,
      s.id as spot_id,
      s.user_id as owner_id,
      s.spot_name,
      p.full_name as owner_name,
      p.auto_compound_enabled,
      p.referred_by_code,
      p.referral_code,
      p.first_cycle_completed_at,
      p.last_payout_at,
      (
        SELECT id FROM profiles
        WHERE referral_code = p.referred_by_code LIMIT 1
      ) as referrer_id,
      (
        SELECT COALESCE(SUM(amount), 0) FROM transactions
        WHERE user_id = s.user_id AND wallet_type = 'deposit' AND status = 'completed'
      ) as deposit_balance,
      (
        SELECT COALESCE(SUM(amount), 0) FROM transactions
        WHERE user_id = s.user_id AND wallet_type = 'earnings' AND status = 'completed'
      ) as earnings_balance,
      (SELECT COUNT(*) FROM spots WHERE user_id = s.user_id) as user_spot_count,
      (SELECT COUNT(*)::int FROM profiles rp WHERE rp.referred_by_code = p.referral_code AND rp.is_member = true) as active_referrals_count
    FROM drops d
    JOIN spots s ON s.id = d.spot_id
    JOIN profiles p ON p.id = s.user_id
    WHERE d.id != _origin_drop_id
      AND d.status IN ('waiting', 'filling')
      AND d.fill_amount < d.target_amount
    ORDER BY d.position ASC
    LIMIT _max_drops
  ) d;

  SELECT COALESCE(MAX(position), 0) INTO v_max_position FROM drops;

  RETURN jsonb_build_object(
    'config', v_config,
    'drops', v_drops,
    'current_max_position', v_max_position
  );
END;
$function$;

-- 2. get_user_drops_status (single arg overload)
CREATE OR REPLACE FUNCTION public.get_user_drops_status(_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_result JSON;
BEGIN
  SELECT json_build_object(
    'spots', COALESCE((
      SELECT json_agg(json_build_object(
        'id', s.id,
        'spot_name', s.spot_name,
        'status', s.status,
        'total_cycles', s.total_cycles,
        'total_earnings', s.total_earnings,
        'created_at', s.created_at,
        'current_drop', (
          SELECT json_build_object(
            'id', d.id,
            'position', d.position,
            'fill_amount', d.fill_amount,
            'target_amount', d.target_amount,
            'status', d.status,
            'fill_percentage', ROUND((d.fill_amount / d.target_amount) * 100, 1)
          )
          FROM drops d
          WHERE d.spot_id = s.id AND d.status IN ('waiting', 'filling')
          ORDER BY d.created_at DESC LIMIT 1
        )
      ) ORDER BY s.created_at ASC)
      FROM spots s
      WHERE s.user_id = _user_id AND s.status = 'active'
    ), '[]'::json)
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

-- 3. get_user_drops_status (paginated overload)
CREATE OR REPLACE FUNCTION public.get_user_drops_status(_user_id uuid, _limit integer DEFAULT 6, _offset integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_result JSON;
  v_total_spots INTEGER;
  v_total_earnings NUMERIC;
  v_total_cycles INTEGER;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(total_earnings), 0), COALESCE(SUM(total_cycles), 0)
  INTO v_total_spots, v_total_earnings, v_total_cycles
  FROM spots WHERE user_id = _user_id AND status = 'active';

  SELECT json_build_object(
    'spots', COALESCE((
      SELECT json_agg(json_build_object(
        'id', s.id,
        'spot_name', s.spot_name,
        'status', s.status,
        'total_cycles', s.total_cycles,
        'total_earnings', s.total_earnings,
        'created_at', s.created_at,
        'current_drop', (
          SELECT json_build_object(
            'id', d.id,
            'position', d.position,
            'fill_amount', d.fill_amount,
            'target_amount', d.target_amount,
            'status', d.status,
            'fill_percentage', ROUND((d.fill_amount / d.target_amount) * 100, 1)
          )
          FROM drops d
          WHERE d.spot_id = s.id AND d.status IN ('waiting', 'filling')
          ORDER BY d.created_at DESC LIMIT 1
        )
      ) ORDER BY s.created_at ASC)
      FROM (
        SELECT * FROM spots
        WHERE user_id = _user_id AND status = 'active'
        ORDER BY created_at ASC
        LIMIT _limit OFFSET _offset
      ) s
    ), '[]'::json),
    'total_spots_count', v_total_spots,
    'total_earnings_all_spots', v_total_earnings,
    'total_cycles_all_spots', v_total_cycles,
    'has_more_spots', (v_total_spots > _limit + _offset)
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

-- 4. write_spot: remove genesis args
DROP FUNCTION IF EXISTS public.write_spot(uuid, text, boolean, integer);
CREATE OR REPLACE FUNCTION public.write_spot(_user_id uuid, _spot_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_spot_id UUID;
BEGIN
  INSERT INTO spots (user_id, spot_name, status)
  VALUES (_user_id, _spot_name, 'active')
  RETURNING id INTO v_spot_id;
  RETURN v_spot_id;
END;
$function$;

-- 5. write_spot_stats: remove genesis args
DROP FUNCTION IF EXISTS public.write_spot_stats(uuid, numeric, integer, integer);
CREATE OR REPLACE FUNCTION public.write_spot_stats(_spot_id uuid, _total_earnings_add numeric, _cycles_add integer DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE spots SET
    total_cycles = total_cycles + _cycles_add,
    total_earnings = total_earnings + _total_earnings_add
  WHERE id = _spot_id;
END;
$function$;

-- 6. write_profile_update: remove genesis_completed_at AND total_recycled_profit (column also doesn't exist)
DROP FUNCTION IF EXISTS public.write_profile_update(uuid, boolean, boolean, numeric, boolean);
CREATE OR REPLACE FUNCTION public.write_profile_update(
  _user_id uuid,
  _set_first_cycle_completed_at boolean DEFAULT false,
  _set_last_payout_at boolean DEFAULT false
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE profiles SET
    first_cycle_completed_at = CASE WHEN _set_first_cycle_completed_at THEN NOW() ELSE first_cycle_completed_at END,
    last_payout_at = CASE WHEN _set_last_payout_at THEN NOW() ELSE last_payout_at END
  WHERE id = _user_id;
END;
$function$;

-- 7. stop_users_changing_locked_profile_fields trigger: remove genesis_completed_at
CREATE OR REPLACE FUNCTION public.stop_users_changing_locked_profile_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'authenticated'
     AND auth.uid() = OLD.id
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.is_member IS DISTINCT FROM OLD.is_member
       OR NEW.pin_hash IS DISTINCT FROM OLD.pin_hash
       OR NEW.referral_code IS DISTINCT FROM OLD.referral_code
       OR NEW.referred_by_code IS DISTINCT FROM OLD.referred_by_code
       OR NEW.is_name_locked IS DISTINCT FROM OLD.is_name_locked
       OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
       OR NEW.banned_at IS DISTINCT FROM OLD.banned_at
       OR NEW.banned_reason IS DISTINCT FROM OLD.banned_reason
       OR NEW.first_cycle_completed_at IS DISTINCT FROM OLD.first_cycle_completed_at
       OR NEW.last_payout_at IS DISTINCT FROM OLD.last_payout_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.metadata IS DISTINCT FROM OLD.metadata THEN
      RAISE EXCEPTION 'This profile setting can only be changed by the secure backend.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 8. pay_user_profit: drop genesis branch
CREATE OR REPLACE FUNCTION public.pay_user_profit(_user_id uuid, _spot_id uuid, _profit_amount numeric, _auto_compound boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile RECORD;
  v_actual_profit NUMERIC;
  v_is_first_cycle BOOLEAN;
BEGIN
  SELECT first_cycle_completed_at, auto_compound_enabled
  INTO v_profile FROM public.profiles WHERE id = _user_id;

  v_is_first_cycle := (v_profile.first_cycle_completed_at IS NULL);
  v_actual_profit := public.get_user_profit_amount(_user_id);

  IF v_is_first_cycle THEN
    UPDATE public.profiles SET first_cycle_completed_at = now() WHERE id = _user_id;
  END IF;

  INSERT INTO public.transactions (user_id, amount, transaction_type, wallet_type, description, status, metadata)
  VALUES (
    _user_id, v_actual_profit, 'drop_profit', 'earnings',
    CASE
      WHEN v_is_first_cycle THEN 'First machine payout (ready to withdraw)'
      WHEN _auto_compound THEN 'Machine payout (auto-reinvested)'
      ELSE 'Machine payout (ready to withdraw)'
    END,
    'completed',
    json_build_object('spot_id', _spot_id, 'auto_compounded', _auto_compound,
      'is_first_cycle', v_is_first_cycle, 'profit_amount', v_actual_profit)
  );

  PERFORM public.send_payout_notification(_user_id, v_actual_profit, _auto_compound);
END;
$function$;

-- 9. distribute_liquidity SQL function: remove genesis check (try_auto_buy_machine no longer exists either)
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
  v_is_first_cycle BOOLEAN;
  v_has_referrer BOOLEAN;
  v_actual_profit NUMERIC;
BEGIN
  SELECT * INTO v_config FROM public.platform_config WHERE id = 1;

  WHILE v_remaining > 0 AND v_depth < _max_depth LOOP
    v_depth := v_depth + 1;

    SELECT d.*, s.id AS spot_id, s.user_id AS spot_owner_id,
           p.auto_compound_enabled, p.referred_by_code, p.first_cycle_completed_at
    INTO v_target_drop
    FROM public.drops d
    JOIN public.spots s ON s.id = d.spot_id
    JOIN public.profiles p ON p.id = s.user_id
    WHERE d.id != _origin_drop_id
      AND d.status IN ('waiting', 'filling')
      AND d.fill_amount < d.target_amount
    ORDER BY d.position ASC
    LIMIT 1;

    IF v_target_drop IS NULL THEN EXIT; END IF;

    v_amount_to_fill := LEAST(v_remaining, v_target_drop.target_amount - v_target_drop.fill_amount);

    UPDATE public.drops
       SET fill_amount = fill_amount + v_amount_to_fill,
           status = CASE WHEN fill_amount + v_amount_to_fill >= target_amount THEN 'completed' ELSE 'filling' END,
           completed_at = CASE WHEN fill_amount + v_amount_to_fill >= target_amount THEN now() ELSE NULL END
     WHERE id = v_target_drop.id;

    v_remaining := v_remaining - v_amount_to_fill;
    v_distributed := v_distributed + v_amount_to_fill;

    IF v_target_drop.fill_amount + v_amount_to_fill >= v_target_drop.target_amount THEN
      v_spot_owner_id := v_target_drop.spot_owner_id;
      v_should_auto_compound := COALESCE(v_target_drop.auto_compound_enabled, false);
      v_is_first_cycle := (v_target_drop.first_cycle_completed_at IS NULL);
      v_has_referrer := (
        v_target_drop.referred_by_code IS NOT NULL
        AND v_target_drop.referred_by_code != ''
        AND v_target_drop.referred_by_code != 'SYSTEM'
      );

      v_actual_profit := CASE
        WHEN v_is_first_cycle THEN v_config.drop_profit_amount
        ELSE v_config.drop_profit_amount_subsequent
      END;

      v_payouts_made := v_payouts_made + 1;

      IF v_has_referrer AND COALESCE(v_config.drop_referral_per_cycle, 0) > 0 THEN
        PERFORM public.pay_referral_bonus(
          v_target_drop.referred_by_code,
          v_spot_owner_id,
          v_config.drop_referral_per_cycle
        );
      END IF;

      PERFORM public.pay_user_profit(
        v_spot_owner_id,
        v_target_drop.spot_id,
        v_config.drop_profit_amount,
        v_should_auto_compound
      );

      UPDATE public.profiles SET last_payout_at = NOW() WHERE id = v_spot_owner_id;

      PERFORM public.update_spot_stats(v_target_drop.spot_id, v_actual_profit);

      UPDATE public.drops SET status = 'paid', paid_at = now() WHERE id = v_target_drop.id;

      PERFORM public.send_payout_notification(v_spot_owner_id, v_actual_profit, v_should_auto_compound);

      INSERT INTO public.drops (spot_id, position, target_amount, fill_amount, status, source_type)
      VALUES (
        v_target_drop.spot_id,
        (SELECT COALESCE(MAX(position), 0) + 1 FROM public.drops),
        v_config.drop_target_amount,
        0,
        'waiting',
        're-entry'
      );
      v_reentries_made := v_reentries_made + 1;

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

-- 10. commit_distribution_batch: remove genesis_completions, auto_compound_triggers, set_genesis_completed_at, total_recycled_profit_add, genesis-specific args
CREATE OR REPLACE FUNCTION public.commit_distribution_batch(_writes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF _writes ? 'drop_paids' THEN
    FOR v_drop_paid IN SELECT * FROM jsonb_array_elements_text(_writes->'drop_paids')
    LOOP PERFORM write_drop_paid(v_drop_paid); END LOOP;
  END IF;

  IF _writes ? 'drop_settleds' THEN
    FOR v_drop_settled IN SELECT * FROM jsonb_array_elements_text(_writes->'drop_settleds')
    LOOP PERFORM write_drop_settled(v_drop_settled); END LOOP;
  END IF;

  IF _writes ? 'new_spots' THEN
    FOR v_new_spot IN SELECT * FROM jsonb_array_elements(_writes->'new_spots')
    LOOP
      SELECT write_spot(
        (v_new_spot->>'user_id')::UUID,
        v_new_spot->>'spot_name'
      ) INTO v_spot_id;
      v_created_ids := jsonb_set(v_created_ids, '{spots}', v_created_ids->'spots' || jsonb_build_array(jsonb_build_object('id', v_spot_id, 'key', v_new_spot->>'key')));
    END LOOP;
  END IF;

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

  IF _writes ? 'profile_updates' THEN
    FOR v_profile_update IN SELECT * FROM jsonb_array_elements(_writes->'profile_updates')
    LOOP
      PERFORM write_profile_update(
        (v_profile_update->>'user_id')::UUID,
        COALESCE((v_profile_update->>'set_first_cycle_completed_at')::BOOLEAN, false),
        COALESCE((v_profile_update->>'set_last_payout_at')::BOOLEAN, false)
      );
    END LOOP;
  END IF;

  IF _writes ? 'spot_stats' THEN
    FOR v_spot_stat IN SELECT * FROM jsonb_array_elements(_writes->'spot_stats')
    LOOP
      PERFORM write_spot_stats(
        (v_spot_stat->>'spot_id')::UUID,
        (v_spot_stat->>'total_earnings_add')::NUMERIC,
        COALESCE((v_spot_stat->>'cycles_add')::INTEGER, 1)
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'created_ids', v_created_ids);
EXCEPTION WHEN OTHERS THEN RAISE;
END;
$function$;