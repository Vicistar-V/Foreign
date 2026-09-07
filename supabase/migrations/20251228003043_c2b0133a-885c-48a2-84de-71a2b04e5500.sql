-- Remove the CHECK constraint on system_alerts.alert_type completely
-- This allows any string value for alert_type (more flexible for future use)

-- First drop the existing constraint if it exists
ALTER TABLE public.system_alerts 
DROP CONSTRAINT IF EXISTS system_alerts_alert_type_check;