-- Set up the pg_cron job for Viketa Drop Pulse (runs every minute)
SELECT cron.schedule(
  'viketa-drop-pulse',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://sbprvewcfrtazdlcfvxt.supabase.co/functions/v1/process-drop-pulse',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNicHJ2ZXdjZnJ0YXpkbGNmdnh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mzc3ODIsImV4cCI6MjA3OTIxMzc4Mn0.-dqqGd8WOaZG-ScJVhHLnFpRDXHSQ8Xq9WxdQ63OI2w", "X-Supabase-Cron": "true"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);