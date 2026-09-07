-- ============================================================
-- USER TOUR PROGRESS TABLE
-- Tracks every signed-in user's progress through the welcome tour.
-- One row per user, lazily upserted by the update_tour_progress RPC.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_tour_progress (
  user_id uuid PRIMARY KEY,
  current_step text NOT NULL DEFAULT 'idle',
  picks_guided integer NOT NULL DEFAULT 0,
  is_completed boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  completed_at timestamptz,
  last_step_at timestamptz NOT NULL DEFAULT now(),
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_tour_progress ENABLE ROW LEVEL SECURITY;

-- Users can read their own progress
CREATE POLICY "Users view own tour progress"
ON public.user_tour_progress FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can read all tour progress
CREATE POLICY "Admins view all tour progress"
ON public.user_tour_progress FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role full access
CREATE POLICY "Service role manages tour progress"
ON public.user_tour_progress FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Indexes for admin filtering
CREATE INDEX IF NOT EXISTS idx_user_tour_progress_completed
  ON public.user_tour_progress (is_completed);
CREATE INDEX IF NOT EXISTS idx_user_tour_progress_step
  ON public.user_tour_progress (current_step);
CREATE INDEX IF NOT EXISTS idx_user_tour_progress_last_step_at
  ON public.user_tour_progress (last_step_at DESC);

-- Touch updated_at on update
CREATE OR REPLACE FUNCTION public.touch_user_tour_progress()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_tour_progress_touch ON public.user_tour_progress;
CREATE TRIGGER user_tour_progress_touch
BEFORE UPDATE ON public.user_tour_progress
FOR EACH ROW EXECUTE FUNCTION public.touch_user_tour_progress();

-- ============================================================
-- RPC: update_tour_progress
-- The signed-in user records their own progress. The function
-- runs as SECURITY DEFINER but enforces auth.uid() server-side
-- so no user can ever write to another user's row.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_tour_progress(
  _step text,
  _increment_picks boolean DEFAULT false,
  _mark_completed boolean DEFAULT false
)
RETURNS public.user_tour_progress
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.user_tour_progress;
  _now timestamptz := now();
  _entry jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  IF _step IS NULL OR length(_step) = 0 OR length(_step) > 64 THEN
    RAISE EXCEPTION 'Invalid step';
  END IF;

  _entry := jsonb_build_object('step', _step, 'at', _now);

  INSERT INTO public.user_tour_progress AS p (
    user_id, current_step, picks_guided, is_completed,
    started_at, completed_at, last_step_at, history
  )
  VALUES (
    _uid,
    _step,
    CASE WHEN _increment_picks THEN 1 ELSE 0 END,
    _mark_completed,
    _now,
    CASE WHEN _mark_completed THEN _now ELSE NULL END,
    _now,
    jsonb_build_array(_entry)
  )
  ON CONFLICT (user_id) DO UPDATE
    SET current_step  = EXCLUDED.current_step,
        picks_guided  = p.picks_guided + CASE WHEN _increment_picks THEN 1 ELSE 0 END,
        is_completed  = p.is_completed OR _mark_completed,
        started_at    = COALESCE(p.started_at, _now),
        completed_at  = CASE
                          WHEN _mark_completed AND p.completed_at IS NULL THEN _now
                          ELSE p.completed_at
                        END,
        last_step_at  = _now,
        history       = (p.history || _entry)
    RETURNING * INTO _row;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.update_tour_progress(text, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_tour_progress(text, boolean, boolean) TO authenticated;
