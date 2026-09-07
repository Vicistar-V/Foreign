-- Create webhook_logs table for audit trail
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  signature TEXT,
  processed_successfully BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_webhook_logs_event_type ON public.webhook_logs(event_type);
CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);
CREATE INDEX idx_webhook_logs_processed ON public.webhook_logs(processed_successfully);

-- Enable RLS
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view webhook logs
CREATE POLICY "Admins can view webhook logs"
  ON public.webhook_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Service role can insert logs
CREATE POLICY "Service role can insert webhook logs"
  ON public.webhook_logs FOR INSERT
  WITH CHECK (true);