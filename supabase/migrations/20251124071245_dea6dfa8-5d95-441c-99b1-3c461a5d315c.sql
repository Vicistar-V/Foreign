-- ============================================
-- PRIORITY 1: CREATE DAILY DROP LOGS TABLE
-- Purpose: Idempotency protection (prevent double payments)
-- ============================================

CREATE TABLE IF NOT EXISTS public.daily_drop_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  drop_date DATE NOT NULL UNIQUE, -- Enforce one payout per day
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  total_participants INTEGER NOT NULL DEFAULT 0,
  total_distributed NUMERIC(12, 2) NOT NULL DEFAULT 0,
  winners_count INTEGER NOT NULL DEFAULT 0,
  protected_count INTEGER NOT NULL DEFAULT 0,
  contributors_count INTEGER NOT NULL DEFAULT 0,
  triggered_by TEXT NOT NULL, -- 'cron' or 'admin'
  admin_id UUID, -- Only set if triggered by admin
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Index for fast date lookups (idempotency check)
CREATE INDEX idx_daily_drop_logs_date ON public.daily_drop_logs(drop_date);

-- Index for admin audit trail
CREATE INDEX idx_daily_drop_logs_admin ON public.daily_drop_logs(admin_id) WHERE admin_id IS NOT NULL;

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

ALTER TABLE public.daily_drop_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all logs (audit trail)
CREATE POLICY "Admins can view all distribution logs"
ON public.daily_drop_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only service role can insert/update (edge functions only)
-- Users and even admins cannot directly modify this table
CREATE POLICY "Service role can manage distribution logs"
ON public.daily_drop_logs
FOR ALL
USING (auth.role() = 'service_role');

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE public.daily_drop_logs IS 'Audit log for daily distribution runs. Ensures idempotency (one payout per day).';
COMMENT ON COLUMN public.daily_drop_logs.drop_date IS 'Date of the distribution (UNIQUE constraint prevents double runs)';
COMMENT ON COLUMN public.daily_drop_logs.status IS 'processing = in progress, completed = success, failed = error occurred';
COMMENT ON COLUMN public.daily_drop_logs.triggered_by IS 'Source of trigger: cron (automated) or admin (manual override)';
COMMENT ON COLUMN public.daily_drop_logs.admin_id IS 'User ID of admin who triggered manual distribution (NULL for cron)';