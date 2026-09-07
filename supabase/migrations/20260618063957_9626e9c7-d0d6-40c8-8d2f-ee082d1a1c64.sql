-- Session replay metadata. Actual rrweb event chunks live in Supabase Storage.
CREATE TABLE public.replay_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_event_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_ms bigint NOT NULL DEFAULT 0,
  event_count integer NOT NULL DEFAULT 0,
  chunk_count integer NOT NULL DEFAULT 0,
  page_url text,
  user_agent text,
  viewport_width integer,
  viewport_height integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_id)
);

GRANT SELECT, INSERT, UPDATE ON public.replay_sessions TO authenticated;
GRANT ALL ON public.replay_sessions TO service_role;

ALTER TABLE public.replay_sessions ENABLE ROW LEVEL SECURITY;

-- Users can create their own session rows (recorder boots up)
CREATE POLICY "Users insert their own replay sessions"
  ON public.replay_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own session rows (heartbeat / chunk count)
CREATE POLICY "Users update their own replay sessions"
  ON public.replay_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can view everything
CREATE POLICY "Admins view all replay sessions"
  ON public.replay_sessions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Helpful indexes
CREATE INDEX idx_replay_sessions_user_id ON public.replay_sessions(user_id, started_at DESC);
CREATE INDEX idx_replay_sessions_started_at ON public.replay_sessions(started_at DESC);
CREATE INDEX idx_replay_sessions_last_event ON public.replay_sessions(last_event_at DESC);

-- Auto-bump updated_at
CREATE TRIGGER trg_replay_sessions_updated_at
  BEFORE UPDATE ON public.replay_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ticket_updated_at();
