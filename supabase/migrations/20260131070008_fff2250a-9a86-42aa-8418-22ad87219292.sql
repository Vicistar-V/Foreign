-- Update update_user_streak to use Lagos timezone for date calculations
CREATE OR REPLACE FUNCTION public.update_user_streak(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record user_gamification%ROWTYPE;
  v_today_lagos DATE := (now() AT TIME ZONE 'Africa/Lagos')::DATE;
  v_yesterday_lagos DATE := ((now() AT TIME ZONE 'Africa/Lagos') - INTERVAL '1 day')::DATE;
  v_new_streak INTEGER;
  v_streak_broken BOOLEAN := false;
BEGIN
  -- Get or create gamification record
  SELECT * INTO v_record FROM user_gamification WHERE user_id = _user_id;
  
  IF NOT FOUND THEN
    -- Create new record
    INSERT INTO user_gamification (user_id, current_streak, last_login_date)
    VALUES (_user_id, 1, v_today_lagos)
    RETURNING * INTO v_record;
    
    RETURN jsonb_build_object(
      'current_streak', 1,
      'longest_streak', 1,
      'streak_broken', false,
      'is_new', true
    );
  END IF;
  
  -- Already logged in today (Lagos time)
  IF v_record.last_login_date = v_today_lagos THEN
    RETURN jsonb_build_object(
      'current_streak', v_record.current_streak,
      'longest_streak', v_record.longest_streak,
      'streak_broken', false,
      'is_new', false
    );
  END IF;
  
  -- Logged in yesterday (Lagos time) - continue streak
  IF v_record.last_login_date = v_yesterday_lagos THEN
    v_new_streak := v_record.current_streak + 1;
  ELSE
    -- Streak broken - reset to 1
    v_new_streak := 1;
    v_streak_broken := true;
  END IF;
  
  -- Update record
  UPDATE user_gamification
  SET 
    current_streak = v_new_streak,
    longest_streak = GREATEST(longest_streak, v_new_streak),
    last_login_date = v_today_lagos,
    -- Reset claimed flags if streak was broken
    streak_day_7_claimed = CASE WHEN v_streak_broken THEN false ELSE streak_day_7_claimed END,
    streak_day_14_claimed = CASE WHEN v_streak_broken THEN false ELSE streak_day_14_claimed END,
    streak_day_30_claimed = CASE WHEN v_streak_broken THEN false ELSE streak_day_30_claimed END,
    updated_at = now()
  WHERE user_id = _user_id;
  
  RETURN jsonb_build_object(
    'current_streak', v_new_streak,
    'longest_streak', GREATEST(v_record.longest_streak, v_new_streak),
    'streak_broken', v_streak_broken,
    'is_new', false
  );
END;
$$;