-- Enable required extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule daily-drop-manager to run every 15 minutes
SELECT cron.schedule(
  'daily-drop-manager',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://sbprvewcfrtazdlcfvxt.supabase.co/functions/v1/daily-drop-manager',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNicHJ2ZXdjZnJ0YXpkbGNmdnh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mzc3ODIsImV4cCI6MjA3OTIxMzc4Mn0.-dqqGd8WOaZG-ScJVhHLnFpRDXHSQ8Xq9WxdQ63OI2w"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);

-- Schedule notification-worker to run every minute
SELECT cron.schedule(
  'notification-worker',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://sbprvewcfrtazdlcfvxt.supabase.co/functions/v1/notification-worker',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNicHJ2ZXdjZnJ0YXpkbGNmdnh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mzc3ODIsImV4cCI6MjA3OTIxMzc4Mn0.-dqqGd8WOaZG-ScJVhHLnFpRDXHSQ8Xq9WxdQ63OI2w"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);

-- Add comment for documentation
COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL - used for automated edge function calls';
COMMENT ON EXTENSION pg_net IS 'Async HTTP client for PostgreSQL - used by pg_cron to call edge functions';