-- =============================================
-- ADD MISSING TASK SYSTEM COLUMNS
-- =============================================

-- Add new columns to missions table
ALTER TABLE missions ADD COLUMN IF NOT EXISTS proof_type TEXT DEFAULT 'screenshot';
ALTER TABLE missions ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS max_completions INTEGER;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add new columns to mission_completions table  
ALTER TABLE mission_completions ADD COLUMN IF NOT EXISTS link_proof TEXT;
ALTER TABLE mission_completions ADD COLUMN IF NOT EXISTS text_proof TEXT;
ALTER TABLE mission_completions ADD COLUMN IF NOT EXISTS image_hash TEXT;

-- =============================================
-- CREATE TASK-MEDIA STORAGE BUCKET
-- =============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('task-media', 'task-media', true, 20971520)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for task-media bucket
CREATE POLICY "Anyone can view task media"
ON storage.objects FOR SELECT
USING (bucket_id = 'task-media');

CREATE POLICY "Admins can upload task media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'task-media' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete task media"
ON storage.objects FOR DELETE
USING (bucket_id = 'task-media' AND has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- HELPER FUNCTION: Get approved count for a task
-- =============================================

CREATE OR REPLACE FUNCTION get_task_approved_count(_mission_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  approved_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO approved_count
  FROM mission_completions
  WHERE mission_id = _mission_id
    AND status = 'approved';
  
  RETURN COALESCE(approved_count, 0);
END;
$$;

-- =============================================
-- FIX: can_complete_mission RPC function
-- =============================================

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
  result JSON;
BEGIN
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
  
  -- Check today's completions for this user
  SELECT COUNT(*)::INTEGER INTO today_count
  FROM mission_completions
  WHERE user_id = _user_id 
    AND mission_id = _mission_id
    AND completed_at::date = CURRENT_DATE
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

-- =============================================
-- UPDATE EXISTING TASKS WITH PROPER DATA
-- =============================================

-- WhatsApp Status Share - main daily task
UPDATE missions SET 
  proof_type = 'screenshot',
  media_url = NULL,
  max_completions = NULL,
  expires_at = NULL
WHERE name = 'WhatsApp Status Share';

-- Join WhatsApp Group - one-time task
UPDATE missions SET 
  proof_type = 'screenshot',
  media_url = NULL,
  max_completions = NULL,
  expires_at = NULL,
  lifetime_limit = 1
WHERE name = 'Join WhatsApp Group';

-- Follow on Facebook - one-time task
UPDATE missions SET 
  proof_type = 'screenshot',
  media_url = NULL,
  max_completions = NULL,
  expires_at = NULL,
  lifetime_limit = 1
WHERE name = 'Follow on Facebook';

-- Join Telegram Channel - one-time task
UPDATE missions SET 
  proof_type = 'screenshot',
  media_url = NULL,
  max_completions = NULL,
  expires_at = NULL,
  lifetime_limit = 1
WHERE name = 'Join Telegram Channel';