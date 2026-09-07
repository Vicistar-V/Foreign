-- Update can_complete_mission to use Nigerian timezone (Africa/Lagos) for ALL daily limits
-- This ensures tasks reset at 12:00 AM Nigerian time, not UTC

CREATE OR REPLACE FUNCTION can_complete_mission(_user_id UUID, _mission_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mission_record RECORD;
  today_count INTEGER;
  lifetime_count INTEGER;
  approved_total INTEGER;
  _nigerian_today DATE;
  result JSON;
BEGIN
  -- Get current date in Nigerian timezone (Africa/Lagos = UTC+1)
  _nigerian_today := (NOW() AT TIME ZONE 'Africa/Lagos')::DATE;

  -- Get mission details
  SELECT * INTO mission_record
  FROM missions
  WHERE id = _mission_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'can_complete', false,
      'reason', 'Task not found or not available'
    );
  END IF;
  
  -- Check if task has expired
  IF mission_record.expires_at IS NOT NULL AND mission_record.expires_at < NOW() THEN
    RETURN json_build_object(
      'can_complete', false,
      'reason', 'This task has ended'
    );
  END IF;
  
  -- Check if task is at max capacity
  IF mission_record.max_completions IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER INTO approved_total
    FROM mission_completions
    WHERE mission_id = _mission_id AND status = 'approved';
    
    IF approved_total >= mission_record.max_completions THEN
      RETURN json_build_object(
        'can_complete', false,
        'reason', 'This task is full - no more spots available'
      );
    END IF;
  END IF;
  
  -- Check today's completions (NIGERIAN TIME) for this user
  SELECT COUNT(*)::INTEGER INTO today_count
  FROM mission_completions
  WHERE user_id = _user_id 
    AND mission_id = _mission_id
    AND (completed_at AT TIME ZONE 'Africa/Lagos')::DATE = _nigerian_today
    AND status != 'rejected';
  
  IF today_count >= mission_record.daily_limit THEN
    RETURN json_build_object(
      'can_complete', false,
      'reason', 'You already did this task today. Come back tomorrow!'
    );
  END IF;
  
  -- Check lifetime completions if limit exists
  IF mission_record.lifetime_limit IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER INTO lifetime_count
    FROM mission_completions
    WHERE user_id = _user_id 
      AND mission_id = _mission_id
      AND status != 'rejected';
    
    IF lifetime_count >= mission_record.lifetime_limit THEN
      RETURN json_build_object(
        'can_complete', false,
        'reason', 'You have reached the maximum times for this task'
      );
    END IF;
  END IF;
  
  -- All checks passed
  RETURN json_build_object(
    'can_complete', true,
    'reason', NULL,
    'today_count', today_count,
    'daily_limit', mission_record.daily_limit,
    'lifetime_count', COALESCE(lifetime_count, 0),
    'lifetime_limit', mission_record.lifetime_limit
  );
END;
$$;