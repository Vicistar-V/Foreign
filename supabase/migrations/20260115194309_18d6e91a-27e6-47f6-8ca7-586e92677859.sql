-- Drop and recreate can_complete_mission with correct return type
DROP FUNCTION IF EXISTS can_complete_mission(uuid, uuid);

-- Recreate can_complete_mission to check capacity and expiry
CREATE OR REPLACE FUNCTION can_complete_mission(_user_id UUID, _mission_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mission RECORD;
  _today_count INTEGER;
  _lifetime_approved INTEGER;
  _pending_count INTEGER;
  _total_approved INTEGER;
BEGIN
  -- Get mission details
  SELECT * INTO _mission FROM missions WHERE id = _mission_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('can_complete', false, 'reason', 'Task not found');
  END IF;
  
  IF NOT _mission.is_active THEN
    RETURN json_build_object('can_complete', false, 'reason', 'This task is no longer available');
  END IF;
  
  -- Check if expired
  IF _mission.expires_at IS NOT NULL AND _mission.expires_at < now() THEN
    RETURN json_build_object('can_complete', false, 'reason', 'This task has expired');
  END IF;
  
  -- Check capacity (total approved across all users)
  IF _mission.max_completions IS NOT NULL THEN
    SELECT COUNT(*) INTO _total_approved
    FROM mission_completions 
    WHERE mission_id = _mission_id AND status = 'approved';
    
    IF _total_approved >= _mission.max_completions THEN
      RETURN json_build_object('can_complete', false, 'reason', 'This task is full - all spots taken');
    END IF;
  END IF;
  
  -- Count today's completions for this user
  SELECT COUNT(*) INTO _today_count
  FROM mission_completions 
  WHERE user_id = _user_id 
    AND mission_id = _mission_id
    AND completed_at::date = CURRENT_DATE;
  
  IF _today_count >= _mission.daily_limit THEN
    RETURN json_build_object('can_complete', false, 'reason', 'Done for today! Come back tomorrow');
  END IF;
  
  -- Check lifetime limit for this user
  IF _mission.lifetime_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO _lifetime_approved
    FROM mission_completions 
    WHERE user_id = _user_id 
      AND mission_id = _mission_id
      AND status = 'approved';
    
    IF _lifetime_approved >= _mission.lifetime_limit THEN
      RETURN json_build_object('can_complete', false, 'reason', 'You have already completed this task');
    END IF;
  END IF;
  
  -- Check for pending submissions
  SELECT COUNT(*) INTO _pending_count
  FROM mission_completions 
  WHERE user_id = _user_id 
    AND mission_id = _mission_id
    AND status = 'pending_review';
  
  IF _pending_count > 0 THEN
    RETURN json_build_object('can_complete', false, 'reason', 'Waiting for your previous submission to be reviewed');
  END IF;
  
  RETURN json_build_object('can_complete', true, 'reason', null);
END;
$$;