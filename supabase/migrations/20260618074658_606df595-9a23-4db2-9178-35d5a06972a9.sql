
-- RPCs to hide replay_sessions table structure from the client.
CREATE OR REPLACE FUNCTION public.record_replay_start(
  p_session_id text,
  p_page_url text,
  p_user_agent text,
  p_viewport_width int,
  p_viewport_height int
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.replay_sessions (
    user_id, session_id, started_at, last_event_at,
    duration_ms, event_count, chunk_count,
    page_url, user_agent, viewport_width, viewport_height
  ) VALUES (
    v_uid, p_session_id, now(), now(),
    0, 0, 0,
    p_page_url, p_user_agent, p_viewport_width, p_viewport_height
  )
  ON CONFLICT (user_id, session_id) DO UPDATE
    SET last_event_at = now(),
        page_url = COALESCE(EXCLUDED.page_url, public.replay_sessions.page_url);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_replay_chunk(
  p_session_id text,
  p_duration_ms bigint,
  p_event_count int,
  p_chunk_count int,
  p_page_url text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.replay_sessions
     SET last_event_at = now(),
         duration_ms   = GREATEST(duration_ms, p_duration_ms),
         event_count   = GREATEST(event_count, p_event_count),
         chunk_count   = GREATEST(chunk_count, p_chunk_count),
         page_url      = COALESCE(p_page_url, page_url)
   WHERE user_id = v_uid
     AND session_id = p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_replay_heartbeat(
  p_session_id text,
  p_duration_ms bigint
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.replay_sessions
     SET last_event_at = now(),
         duration_ms   = GREATEST(duration_ms, p_duration_ms)
   WHERE user_id = v_uid
     AND session_id = p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_replay_end(
  p_session_id text,
  p_duration_ms bigint
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.replay_sessions
     SET ended_at      = COALESCE(ended_at, now()),
         last_event_at = now(),
         duration_ms   = GREATEST(duration_ms, p_duration_ms)
   WHERE user_id = v_uid
     AND session_id = p_session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_replay_start(text,text,text,int,int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_replay_chunk(text,bigint,int,int,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_replay_heartbeat(text,bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_replay_end(text,bigint) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.record_replay_start(text,text,text,int,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_replay_chunk(text,bigint,int,int,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_replay_heartbeat(text,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_replay_end(text,bigint) TO authenticated;
