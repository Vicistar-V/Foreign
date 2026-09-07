-- Create user_activity_log table for tracking user journeys
CREATE TABLE public.user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  page_path TEXT NOT NULL,
  page_name TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'page_view',
  action_detail TEXT,
  session_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for efficient querying
CREATE INDEX idx_user_activity_user_id ON public.user_activity_log(user_id);
CREATE INDEX idx_user_activity_created_at ON public.user_activity_log(created_at DESC);
CREATE INDEX idx_user_activity_session_id ON public.user_activity_log(session_id);
CREATE INDEX idx_user_activity_user_created ON public.user_activity_log(user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

-- Users can INSERT their own activity (write-only, can't read their own data)
CREATE POLICY "Users can insert their own activity"
ON public.user_activity_log
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can SELECT all activity for monitoring
CREATE POLICY "Admins can view all activity"
ON public.user_activity_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can manage all activity (for cleanup jobs)
CREATE POLICY "Service role can manage all activity"
ON public.user_activity_log
FOR ALL
USING (auth.role() = 'service_role');

-- Add comment explaining the table
COMMENT ON TABLE public.user_activity_log IS 'Tracks user navigation and actions for journey analytics. Data retained for 30 days.';