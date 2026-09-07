
-- Set up automatic verification of pending withdrawals every 5 minutes
SELECT cron.schedule(
  'verify-pending-withdrawals',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://sbprvewcfrtazdlcfvxt.supabase.co/functions/v1/verify-pending-withdrawals',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNicHJ2ZXdjZnJ0YXpkbGNmdnh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYwMTMzNzEsImV4cCI6MjA1MTU4OTM3MX0.VCDRnHfFtUY3n0e5JcJhLqNLaJ0i3FrjQyT6eY4Oa_I"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);
