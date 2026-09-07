-- =====================================================
-- VIKETA V3: AUTOPILOT NODE CALIBRATION ENGINE
-- Implementation of daily-task-driven liquidity gating
-- =====================================================

-- 1. EXTEND PLATFORM CONFIG with calibration settings
ALTER TABLE public.platform_config
  ADD COLUMN IF NOT EXISTS calibration_enabled          boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS calibration_clicks_per_batch integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS calibration_base_batches     integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS calibration_threshold_batches integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS calibration_bonus_per_referral integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS calibration_burn_percentage  numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS calibration_burn_enabled     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS calibration_simulation_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS calibration_grace_period_days integer NOT NULL DEFAULT 3;

-- 2. EXTEND PROFILE with simulation and burn stats
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS simulated_yield    numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_burned_yield numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calibration_activated_at timestamptz;

-- 3. EXTEND GAMIFICATION with calibration streak
ALTER TABLE public.user_gamification
  ADD COLUMN IF NOT EXISTS calibration_streak      integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_calibration_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_calibration_date   date;

-- 4. CREATE CALIBRATION LOG table
CREATE TABLE IF NOT EXISTS public.daily_calibration_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  calibration_date date NOT NULL DEFAULT CURRENT_DATE,
  
  clicks_completed   integer NOT NULL DEFAULT 0,
  batches_completed  integer NOT NULL DEFAULT 0,
  base_batch_limit   integer NOT NULL DEFAULT 10,
  bonus_batches      integer NOT NULL DEFAULT 0,
  total_batch_limit  integer NOT NULL DEFAULT 10,
  
  threshold_reached  boolean NOT NULL DEFAULT false,
  threshold_required integer NOT NULL DEFAULT 7,
  
  pending_yield      numeric NOT NULL DEFAULT 0,
  released_yield     numeric NOT NULL DEFAULT 0,
  burned_yield       numeric NOT NULL DEFAULT 0,
  
  first_click_at     timestamptz,
  last_click_at      timestamptz,
  threshold_reached_at timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, calibration_date)
);

-- RLS for calibration log
ALTER TABLE public.daily_calibration_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own calibration logs"
    ON public.daily_calibration_log FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_calibration_user_date 
  ON public.daily_calibration_log(user_id, calibration_date DESC);

-- 5. RPC: Get or Create Today's Calibration Log
CREATE OR REPLACE FUNCTION public.get_or_create_daily_calibration(_user_id uuid)
RETURNS public.daily_calibration_log AS $$
DECLARE
  _config record;
  _log public.daily_calibration_log;
  _bonus_batches integer := 0;
BEGIN
  -- Get config
  SELECT 
    calibration_base_batches, 
    calibration_threshold_batches
  INTO _config FROM platform_config WHERE id = 1;

  -- Try to get existing row
  SELECT * INTO _log FROM daily_calibration_log
  WHERE user_id = _user_id AND calibration_date = CURRENT_DATE;

  -- If exists, return
  IF _log IS NOT NULL THEN
    RETURN _log;
  END IF;

  -- Calculate bonus batches for today (could be persistent or based on referrals)
  -- For now, we'll let it be updated via other RPCs, but we'll default to 0 bonus
  
  -- Create new row
  INSERT INTO daily_calibration_log (
    user_id,
    calibration_date,
    base_batch_limit,
    total_batch_limit,
    threshold_required
  ) VALUES (
    _user_id,
    CURRENT_DATE,
    _config.calibration_base_batches,
    _config.calibration_base_batches,
    _config.calibration_threshold_batches
  )
  RETURNING * INTO _log;

  RETURN _log;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC: Record Calibration Clicks
CREATE OR REPLACE FUNCTION public.record_calibration_clicks(_user_id uuid, _click_count integer)
RETURNS jsonb AS $$
DECLARE
  _config record;
  _log record;
  _max_clicks integer;
  _new_clicks integer;
  _new_batches integer;
  _old_batches integer;
  _threshold_just_reached boolean := false;
BEGIN
  -- Get config
  SELECT 
    calibration_clicks_per_batch,
    calibration_base_batches,
    calibration_threshold_batches
  INTO _config
  FROM platform_config WHERE id = 1;

  -- Get today's calibration log
  SELECT * INTO _log
  FROM daily_calibration_log
  WHERE user_id = _user_id AND calibration_date = CURRENT_DATE
  FOR UPDATE;

  IF _log IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No calibration session found.');
  END IF;

  -- Rate limit check
  IF _log.last_click_at IS NOT NULL AND 
     (EXTRACT(EPOCH FROM (now() - _log.last_click_at)) * 1000) < 200 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Too fast!');
  END IF;

  _max_clicks := _log.total_batch_limit * _config.calibration_clicks_per_batch;
  
  IF _log.clicks_completed >= _max_clicks THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Daily limit reached!',
      'daily_limit_reached', true
    );
  END IF;

  _old_batches := _log.batches_completed;
  _new_clicks := LEAST(_log.clicks_completed + _click_count, _max_clicks);
  _new_batches := _new_clicks / _config.calibration_clicks_per_batch;
  
  IF NOT _log.threshold_reached AND _new_batches >= _log.threshold_required THEN
    _threshold_just_reached := true;
  END IF;

  UPDATE daily_calibration_log
  SET 
    clicks_completed = _new_clicks,
    batches_completed = _new_batches,
    first_click_at = COALESCE(first_click_at, now()),
    last_click_at = now(),
    threshold_reached = CASE WHEN _threshold_just_reached THEN true ELSE threshold_reached END,
    threshold_reached_at = CASE WHEN _threshold_just_reached THEN now() ELSE threshold_reached_at END,
    updated_at = now()
  WHERE id = _log.id;

  -- Update streak if reached
  IF _threshold_just_reached THEN
    INSERT INTO user_gamification (user_id, calibration_streak, longest_calibration_streak, last_calibration_date)
    VALUES (_user_id, 1, 1, CURRENT_DATE)
    ON CONFLICT (user_id) DO UPDATE
    SET 
      calibration_streak = CASE
        WHEN user_gamification.last_calibration_date = CURRENT_DATE - 1 THEN user_gamification.calibration_streak + 1
        WHEN user_gamification.last_calibration_date = CURRENT_DATE THEN user_gamification.calibration_streak
        ELSE 1
      END,
      longest_calibration_streak = GREATEST(
        user_gamification.longest_calibration_streak,
        CASE
          WHEN user_gamification.last_calibration_date = CURRENT_DATE - 1 THEN user_gamification.calibration_streak + 1
          WHEN user_gamification.last_calibration_date = CURRENT_DATE THEN user_gamification.calibration_streak
          ELSE 1
        END
      ),
      last_calibration_date = CURRENT_DATE,
      updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'clicks_completed', _new_clicks,
    'batches_completed', _new_batches,
    'total_batch_limit', _log.total_batch_limit,
    'threshold_reached', _log.threshold_reached OR _threshold_just_reached,
    'threshold_required', _log.threshold_required,
    'threshold_just_reached', _threshold_just_reached,
    'batch_just_completed', (_new_batches > _old_batches),
    'daily_limit_reached', (_new_clicks >= _max_clicks)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: Add Pending Yield
CREATE OR REPLACE FUNCTION public.add_pending_yield(_user_id uuid, _amount numeric)
RETURNS void AS $$
BEGIN
  -- Use get_or_create to ensure log exists
  PERFORM get_or_create_daily_calibration(_user_id);
  
  UPDATE daily_calibration_log
  SET pending_yield = pending_yield + _amount,
      updated_at = now()
  WHERE user_id = _user_id AND calibration_date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC: Release Pending Yield
CREATE OR REPLACE FUNCTION public.release_pending_calibration_yield(_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  _log record;
  _amount numeric;
BEGIN
  SELECT * INTO _log FROM daily_calibration_log
  WHERE user_id = _user_id AND calibration_date = CURRENT_DATE
  FOR UPDATE;

  IF _log IS NULL OR _log.pending_yield <= 0 OR NOT _log.threshold_reached THEN
    RETURN jsonb_build_object('released', 0);
  END IF;

  _amount := _log.pending_yield;

  -- 1. Credit the earnings wallet
  UPDATE profiles 
  SET earnings_balance = earnings_balance + _amount
  WHERE id = _user_id;

  -- 2. Record transaction
  INSERT INTO transactions (
    user_id, 
    wallet_type, 
    amount, 
    transaction_type, 
    description, 
    status,
    metadata
  ) VALUES (
    _user_id, 
    'earnings', 
    _amount, 
    'node_yield', 
    'Released node calibration yield', 
    'completed',
    jsonb_build_object('calibration_log_id', _log.id)
  );

  -- 3. Update log
  UPDATE daily_calibration_log
  SET released_yield = released_yield + _amount,
      pending_yield = 0,
      updated_at = now()
  WHERE id = _log.id;

  RETURN jsonb_build_object('released', _amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. RPC: Add Calibration Batches for Referral
CREATE OR REPLACE FUNCTION public.add_calibration_batches_for_referral(_user_id uuid, _batches_to_add integer)
RETURNS void AS $$
BEGIN
  -- Use get_or_create to ensure log exists
  PERFORM get_or_create_daily_calibration(_user_id);
  
  UPDATE daily_calibration_log
  SET bonus_batches = bonus_batches + _batches_to_add,
      total_batch_limit = total_batch_limit + _batches_to_add,
      updated_at = now()
  WHERE user_id = _user_id AND calibration_date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
