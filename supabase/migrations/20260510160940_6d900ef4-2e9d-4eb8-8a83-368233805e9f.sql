
-- RPC: record_user_heartbeat
-- Updates profiles.last_seen_at and optionally inserts into user_activity_log
CREATE OR REPLACE FUNCTION public.record_user_heartbeat(
  p_page_path text DEFAULT NULL,
  p_page_name text DEFAULT NULL,
  p_action_type text DEFAULT NULL,
  p_action_detail text DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Always bump last_seen_at
  UPDATE public.profiles
  SET last_seen_at = now()
  WHERE id = v_user_id;

  -- If page details are provided, log the activity
  IF p_page_path IS NOT NULL AND p_session_id IS NOT NULL THEN
    INSERT INTO public.user_activity_log (
      user_id, page_path, page_name, action_type, action_detail, session_id, metadata
    ) VALUES (
      v_user_id,
      p_page_path,
      COALESCE(p_page_name, 'Unknown Page'),
      COALESCE(p_action_type, 'page_view'),
      p_action_detail,
      p_session_id,
      COALESCE(p_metadata, '{}'::jsonb)
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_user_heartbeat(text, text, text, text, text, jsonb) TO authenticated;

-- Enable realtime for admin live monitoring
ALTER TABLE public.user_activity_log REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_activity_log;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END$$;
