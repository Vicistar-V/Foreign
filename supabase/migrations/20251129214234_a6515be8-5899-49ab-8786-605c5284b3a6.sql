-- =====================================================
-- ADMIN ALERTING SYSTEM: Phase 1 - Database Setup
-- =====================================================

-- Add admin alert email to platform_config
ALTER TABLE public.platform_config 
ADD COLUMN IF NOT EXISTS admin_alert_email TEXT DEFAULT 'admin@viketa.xyz';

COMMENT ON COLUMN public.platform_config.admin_alert_email IS 
'Email address for critical system alerts (distribution failures, withdrawal failures, etc.)';

-- Create system_alerts table for audit trail
CREATE TABLE IF NOT EXISTS public.system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('distribution_failed', 'withdrawal_failed', 'system_critical_error', 'chargeback_detected')),
  severity TEXT NOT NULL DEFAULT 'critical' CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Index for fast querying of unacknowledged alerts
CREATE INDEX IF NOT EXISTS idx_system_alerts_acknowledged 
ON public.system_alerts (acknowledged_at) 
WHERE acknowledged_at IS NULL;

-- Index for alert type filtering
CREATE INDEX IF NOT EXISTS idx_system_alerts_type 
ON public.system_alerts (alert_type, created_at DESC);

-- Enable RLS
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can view/manage alerts
CREATE POLICY "Admins can view all system alerts"
ON public.system_alerts
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can acknowledge alerts"
ON public.system_alerts
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert alerts
CREATE POLICY "Service role can insert alerts"
ON public.system_alerts
FOR INSERT
WITH CHECK (true);

COMMENT ON TABLE public.system_alerts IS 
'Audit trail of all critical system alerts sent to administrators. Provides accountability and history of system issues.';