-- Trigger to notify admins when a mission is submitted for review
CREATE OR REPLACE FUNCTION public.notify_admin_new_mission_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_name TEXT;
  _mission_name TEXT;
BEGIN
  -- Get user and mission names
  SELECT full_name INTO _user_name FROM profiles WHERE id = NEW.user_id;
  SELECT name INTO _mission_name FROM missions WHERE id = NEW.mission_id;
  
  -- Create admin notification
  INSERT INTO admin_notifications (
    notification_type,
    title,
    message,
    link
  ) VALUES (
    'mission_submission',
    'New Task Proof',
    COALESCE(_user_name, 'User') || ' submitted proof for ' || COALESCE(_mission_name, 'task'),
    '/admin/mission-reviews'
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger on mission_completions
DROP TRIGGER IF EXISTS on_mission_submitted ON mission_completions;
CREATE TRIGGER on_mission_submitted
  AFTER INSERT ON mission_completions
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_new_mission_submission();