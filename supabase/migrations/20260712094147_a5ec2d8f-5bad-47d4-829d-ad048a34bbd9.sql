
DROP POLICY IF EXISTS "Service role can insert alerts" ON public.system_alerts;
CREATE POLICY "Service role can insert alerts"
  ON public.system_alerts
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert webhook logs" ON public.webhook_logs;
CREATE POLICY "Service role can insert webhook logs"
  ON public.webhook_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);
