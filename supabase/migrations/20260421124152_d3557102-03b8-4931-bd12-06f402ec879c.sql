-- 1. Fix add_pending_yield: it referenced non-existent column `last_action_at` and called get_or_create_daily_calibration with wrong arity
CREATE OR REPLACE FUNCTION public.add_pending_yield(_user_id uuid, _amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Ensure today's log exists, then increment pending yield
  PERFORM public.get_or_create_daily_calibration(_user_id);

  UPDATE daily_calibration_log
  SET 
    pending_yield = COALESCE(pending_yield, 0) + _amount,
    updated_at = now()
  WHERE user_id = _user_id AND calibration_date = CURRENT_DATE;
END;
$function$;

-- 2. Add new platform_config columns
ALTER TABLE public.platform_config
  ADD COLUMN IF NOT EXISTS calibration_simulation_cap numeric NOT NULL DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS calibration_threshold_per_spot integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS calibration_threshold_per_spot_cap integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS calibration_simulated_yield_per_batch numeric NOT NULL DEFAULT 90;

-- 3. New RPC: increment simulated_yield safely up to a cap
CREATE OR REPLACE FUNCTION public.increment_simulated_yield(_user_id uuid, _amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _cap numeric;
  _current numeric;
  _new numeric;
  _added numeric;
BEGIN
  SELECT calibration_simulation_cap INTO _cap FROM platform_config WHERE id = 1;
  IF _cap IS NULL THEN _cap := 10000; END IF;

  SELECT COALESCE(simulated_yield, 0) INTO _current FROM profiles WHERE id = _user_id;
  
  _new := LEAST(_current + GREATEST(_amount, 0), _cap);
  _added := _new - _current;

  IF _added > 0 THEN
    UPDATE profiles SET simulated_yield = _new WHERE id = _user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'previous', _current,
    'new_total', _new,
    'added', _added,
    'cap', _cap,
    'cap_reached', _new >= _cap
  );
END;
$function$;

-- 4. Update get_or_create_daily_calibration to scale threshold by active spot count
CREATE OR REPLACE FUNCTION public.get_or_create_daily_calibration(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _config record;
  _bonus integer;
  _spot_count integer;
  _per_spot_extra integer;
  _final_threshold integer;
  _result record;
BEGIN
  SELECT 
    calibration_clicks_per_batch,
    calibration_base_batches,
    calibration_threshold_batches,
    calibration_bonus_per_referral,
    calibration_threshold_per_spot,
    calibration_threshold_per_spot_cap
  INTO _config
  FROM platform_config WHERE id = 1;

  -- Count user's active members referrals for bonus batches
  SELECT COALESCE(COUNT(*), 0)::integer INTO _bonus
  FROM profiles
  WHERE referred_by_code = (SELECT referral_code FROM profiles WHERE id = _user_id)
    AND is_member = true;

  -- Count user's active spots (1 minimum to avoid negative scaling for non-spot owners)
  SELECT COALESCE(COUNT(*), 0)::integer INTO _spot_count
  FROM spots
  WHERE user_id = _user_id AND status = 'active';

  -- Per-spot threshold scaling: extra batches for each spot beyond the first, capped
  _per_spot_extra := LEAST(
    GREATEST(_spot_count - 1, 0) * COALESCE(_config.calibration_threshold_per_spot, 0),
    COALESCE(_config.calibration_threshold_per_spot_cap, 5)
  );
  _final_threshold := _config.calibration_threshold_batches + _per_spot_extra;

  INSERT INTO daily_calibration_log (
    user_id,
    calibration_date,
    base_batch_limit,
    bonus_batches,
    total_batch_limit,
    threshold_required
  ) VALUES (
    _user_id,
    CURRENT_DATE,
    _config.calibration_base_batches,
    LEAST(_bonus * _config.calibration_bonus_per_referral, 50),
    _config.calibration_base_batches + LEAST(_bonus * _config.calibration_bonus_per_referral, 50),
    _final_threshold
  )
  ON CONFLICT (user_id, calibration_date) DO UPDATE
    SET 
      threshold_required = EXCLUDED.threshold_required,
      updated_at = now()
  RETURNING * INTO _result;

  UPDATE profiles
  SET calibration_activated_at = now()
  WHERE id = _user_id AND calibration_activated_at IS NULL;

  RETURN jsonb_build_object(
    'id', _result.id,
    'user_id', _result.user_id,
    'calibration_date', _result.calibration_date,
    'clicks_completed', _result.clicks_completed,
    'batches_completed', _result.batches_completed,
    'base_batch_limit', _result.base_batch_limit,
    'bonus_batches', _result.bonus_batches,
    'total_batch_limit', _result.total_batch_limit,
    'threshold_reached', _result.threshold_reached,
    'threshold_required', _result.threshold_required,
    'pending_yield', _result.pending_yield,
    'released_yield', _result.released_yield,
    'burned_yield', _result.burned_yield,
    'first_click_at', _result.first_click_at,
    'last_click_at', _result.last_click_at,
    'threshold_reached_at', _result.threshold_reached_at,
    'clicks_per_batch', _config.calibration_clicks_per_batch,
    'active_spot_count', _spot_count
  );
END;
$function$;