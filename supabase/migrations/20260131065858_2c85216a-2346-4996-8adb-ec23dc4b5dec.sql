-- Update check_daily_spin_eligible to reset at midnight Lagos time instead of 24-hour window
CREATE OR REPLACE FUNCTION public.check_daily_spin_eligible(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_spin TIMESTAMP WITH TIME ZONE;
  v_last_spin_date DATE;
  v_today_lagos DATE;
  v_next_midnight TIMESTAMP WITH TIME ZONE;
  v_is_eligible BOOLEAN;
  v_seconds_remaining INTEGER;
BEGIN
  -- Get user's last daily spin
  SELECT last_daily_spin_at INTO v_last_spin
  FROM user_gamification
  WHERE user_id = _user_id;
  
  -- If never spun before, they're eligible
  IF v_last_spin IS NULL THEN
    RETURN jsonb_build_object(
      'eligible', true,
      'next_spin_at', NULL,
      'seconds_remaining', 0
    );
  END IF;
  
  -- Get today's date in Lagos timezone
  v_today_lagos := (now() AT TIME ZONE 'Africa/Lagos')::DATE;
  
  -- Get the date of last spin in Lagos timezone
  v_last_spin_date := (v_last_spin AT TIME ZONE 'Africa/Lagos')::DATE;
  
  -- User is eligible if they haven't spun today (Lagos time)
  v_is_eligible := v_last_spin_date < v_today_lagos;
  
  -- Calculate next midnight Lagos time (start of tomorrow)
  v_next_midnight := ((v_today_lagos + INTERVAL '1 day')::TIMESTAMP AT TIME ZONE 'Africa/Lagos');
  
  -- Calculate seconds until next midnight
  v_seconds_remaining := CASE 
    WHEN v_is_eligible THEN 0
    ELSE GREATEST(0, EXTRACT(EPOCH FROM (v_next_midnight - now()))::INTEGER)
  END;
  
  RETURN jsonb_build_object(
    'eligible', v_is_eligible,
    'next_spin_at', CASE WHEN v_is_eligible THEN NULL ELSE v_next_midnight END,
    'seconds_remaining', v_seconds_remaining
  );
END;
$$;