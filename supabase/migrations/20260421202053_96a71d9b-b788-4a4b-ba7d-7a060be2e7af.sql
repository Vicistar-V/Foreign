
-- Add auth.uid() enforcement to calibration RPCs.
-- Service role bypasses (auth.uid() IS NULL when called with service key).

CREATE OR REPLACE FUNCTION public.get_or_create_daily_calibration(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Africa/Lagos')::date;
  v_row public.daily_calibration_log;
  v_config public.platform_config;
  v_spot_count integer;
  v_threshold_per_spot integer;
  v_is_member boolean;
BEGIN
  -- Authorize: only the user themselves (or service role) may act
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO v_config FROM public.platform_config WHERE id = 1;

  SELECT is_member INTO v_is_member FROM public.profiles WHERE id = _user_id;
  SELECT COUNT(*) INTO v_spot_count FROM public.spots WHERE user_id = _user_id AND status = 'active';

  IF NOT COALESCE(v_is_member, false) OR v_spot_count = 0 THEN
    v_spot_count := 1;
  END IF;

  v_threshold_per_spot := LEAST(v_spot_count, v_config.calibration_threshold_per_spot_cap);

  SELECT * INTO v_row
  FROM public.daily_calibration_log
  WHERE user_id = _user_id AND log_date = v_today;

  IF v_row.id IS NULL THEN
    INSERT INTO public.daily_calibration_log (
      user_id, log_date, total_batch_limit, threshold_required
    ) VALUES (
      _user_id, v_today,
      v_config.calibration_base_batches,
      v_config.calibration_threshold_batches
    )
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'log', to_jsonb(v_row),
    'config', jsonb_build_object(
      'clicks_per_batch', v_config.calibration_clicks_per_batch,
      'base_batches', v_config.calibration_base_batches,
      'threshold_batches', v_config.calibration_threshold_batches,
      'bonus_per_referral', v_config.calibration_bonus_per_referral,
      'simulation_enabled', v_config.calibration_simulation_enabled,
      'simulation_cap', v_config.calibration_simulation_cap,
      'simulated_yield_per_batch', v_config.calibration_simulated_yield_per_batch,
      'threshold_per_spot_cap', v_config.calibration_threshold_per_spot_cap,
      'enabled', v_config.calibration_enabled,
      'min_click_interval_ms', v_config.calibration_min_click_interval_ms
    ),
    'spot_count', v_spot_count,
    'threshold_per_spot', v_threshold_per_spot,
    'is_member', COALESCE(v_is_member, false),
    'simulated_yield', (SELECT simulated_yield FROM public.profiles WHERE id = _user_id),
    'streak', (SELECT calibration_streak FROM public.profiles WHERE id = _user_id),
    'today', v_today
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_calibration_clicks(_user_id uuid, _click_count integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Africa/Lagos')::date;
  v_row public.daily_calibration_log;
  v_config public.platform_config;
  v_clicks_per_batch integer;
  v_max_clicks integer;
  v_new_clicks integer;
  v_new_batches integer;
  v_old_batches integer;
  v_batches_added integer;
  v_yield_added numeric := 0;
  v_min_interval_ms integer;
  v_ms_since_last bigint;
  v_threshold_unlocked_now boolean := false;
  v_is_member boolean;
  v_new_simulated numeric;
  v_yesterday date;
  v_streak integer;
  v_longest integer;
  v_last_cal_date date;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _click_count IS NULL OR _click_count <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid click count');
  END IF;

  IF _click_count > 30 THEN
    _click_count := 30;
  END IF;

  SELECT * INTO v_config FROM public.platform_config WHERE id = 1;

  IF NOT v_config.calibration_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'Calibration is currently disabled');
  END IF;

  v_clicks_per_batch := v_config.calibration_clicks_per_batch;
  v_min_interval_ms := v_config.calibration_min_click_interval_ms;

  PERFORM public.get_or_create_daily_calibration(_user_id);

  SELECT * INTO v_row
  FROM public.daily_calibration_log
  WHERE user_id = _user_id AND log_date = v_today
  FOR UPDATE;

  v_max_clicks := v_row.total_batch_limit * v_clicks_per_batch;

  IF v_row.clicks_completed >= v_max_clicks THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Daily limit reached',
      'limit_reached', true,
      'log', to_jsonb(v_row)
    );
  END IF;

  IF v_row.last_click_at IS NOT NULL THEN
    v_ms_since_last := EXTRACT(EPOCH FROM (now() - v_row.last_click_at)) * 1000;
    IF v_ms_since_last < v_min_interval_ms THEN
      DECLARE
        v_allowed integer;
      BEGIN
        v_allowed := GREATEST(1, FLOOR(v_ms_since_last / v_min_interval_ms))::integer;
        IF v_allowed < _click_count THEN
          _click_count := v_allowed;
        END IF;
      END;
    END IF;
  END IF;

  v_new_clicks := LEAST(v_row.clicks_completed + _click_count, v_max_clicks);
  v_old_batches := v_row.batches_completed;
  v_new_batches := v_new_clicks / v_clicks_per_batch;
  v_batches_added := GREATEST(0, v_new_batches - v_old_batches);

  IF NOT v_row.threshold_reached AND v_new_batches >= v_row.threshold_required THEN
    v_threshold_unlocked_now := true;
  END IF;

  IF v_batches_added > 0 THEN
    v_yield_added := v_config.calibration_simulated_yield_per_batch * v_batches_added;
  END IF;

  UPDATE public.daily_calibration_log
  SET clicks_completed = v_new_clicks,
      batches_completed = v_new_batches,
      pending_yield = pending_yield + v_yield_added,
      first_click_at = COALESCE(first_click_at, now()),
      last_click_at = now(),
      threshold_reached = (v_new_batches >= threshold_required) OR threshold_reached,
      threshold_reached_at = CASE
        WHEN threshold_reached_at IS NULL AND v_new_batches >= threshold_required THEN now()
        ELSE threshold_reached_at
      END
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  IF v_batches_added > 0 THEN
    SELECT is_member, last_calibration_date, calibration_streak, longest_calibration_streak
      INTO v_is_member, v_last_cal_date, v_streak, v_longest
    FROM public.profiles WHERE id = _user_id FOR UPDATE;

    IF v_last_cal_date IS DISTINCT FROM v_today THEN
      v_yesterday := v_today - 1;
      IF v_last_cal_date = v_yesterday THEN
        v_streak := COALESCE(v_streak, 0) + 1;
      ELSE
        v_streak := 1;
      END IF;
      v_longest := GREATEST(COALESCE(v_longest, 0), v_streak);

      UPDATE public.profiles
      SET last_calibration_date = v_today,
          calibration_streak = v_streak,
          longest_calibration_streak = v_longest
      WHERE id = _user_id;
    END IF;

    IF NOT COALESCE(v_is_member, false) AND v_config.calibration_simulation_enabled THEN
      UPDATE public.profiles
      SET simulated_yield = LEAST(
        simulated_yield + v_yield_added,
        v_config.calibration_simulation_cap
      )
      WHERE id = _user_id
      RETURNING simulated_yield INTO v_new_simulated;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'log', to_jsonb(v_row),
    'batches_added', v_batches_added,
    'yield_added', v_yield_added,
    'threshold_unlocked_now', v_threshold_unlocked_now,
    'simulated_yield', COALESCE(v_new_simulated, (SELECT simulated_yield FROM public.profiles WHERE id = _user_id)),
    'streak', COALESCE(v_streak, (SELECT calibration_streak FROM public.profiles WHERE id = _user_id))
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_pending_calibration_yield(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Africa/Lagos')::date;
  v_row public.daily_calibration_log;
  v_config public.platform_config;
  v_is_member boolean;
  v_release_amount numeric := 0;
  v_burn_amount numeric := 0;
  v_coverage_ratio numeric;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO v_config FROM public.platform_config WHERE id = 1;

  SELECT * INTO v_row
  FROM public.daily_calibration_log
  WHERE user_id = _user_id AND log_date = v_today
  FOR UPDATE;

  IF v_row.id IS NULL OR v_row.pending_yield <= 0 THEN
    RETURN jsonb_build_object('success', true, 'released', 0, 'burned', 0);
  END IF;

  SELECT is_member INTO v_is_member FROM public.profiles WHERE id = _user_id;

  IF v_row.threshold_reached THEN
    v_release_amount := v_row.pending_yield;
  ELSE
    v_coverage_ratio := LEAST(1.0, v_row.batches_completed::numeric / NULLIF(v_row.threshold_required, 0));
    v_release_amount := v_row.pending_yield * v_coverage_ratio;
    v_burn_amount := v_row.pending_yield - v_release_amount;
  END IF;

  UPDATE public.daily_calibration_log
  SET pending_yield = 0,
      released_yield = released_yield + v_release_amount,
      burned_yield = burned_yield + v_burn_amount
  WHERE id = v_row.id;

  IF v_burn_amount > 0 THEN
    UPDATE public.profiles
    SET total_burned_yield = total_burned_yield + v_burn_amount
    WHERE id = _user_id;

    INSERT INTO public.transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
    VALUES (
      '00000000-0000-0000-0000-000000000000', 'earnings', v_burn_amount, 'platform_fee',
      'Calibration burn (threshold not met)', 'completed',
      jsonb_build_object('burned_user_id', _user_id, 'log_date', v_today)
    );
  END IF;

  IF v_release_amount > 0 THEN
    IF COALESCE(v_is_member, false) THEN
      INSERT INTO public.transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
      VALUES (
        _user_id, 'earnings', v_release_amount, 'genesis_yield',
        'Calibration yield released', 'completed',
        jsonb_build_object('source', 'calibration', 'log_date', v_today)
      );
    ELSE
      NULL;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'released', v_release_amount,
    'burned', v_burn_amount,
    'is_member', COALESCE(v_is_member, false)
  );
END;
$function$;
