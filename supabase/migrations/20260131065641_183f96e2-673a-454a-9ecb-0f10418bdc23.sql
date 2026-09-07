-- Schedule leaderboard prize distribution for Sunday at 23:00 UTC (midnight Lagos time)
SELECT cron.schedule(
  'weekly-leaderboard-prizes',
  '0 23 * * 0',
  $$
  SELECT net.http_post(
    url:='https://sbprvewcfrtazdlcfvxt.supabase.co/functions/v1/distribute-leaderboard-prizes',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNicHJ2ZXdjZnJ0YXpkbGNmdnh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mzc3ODIsImV4cCI6MjA3OTIxMzc4Mn0.-dqqGd8WOaZG-ScJVhHLnFpRDXHSQ8Xq9WxdQ63OI2w"}'::jsonb,
    body:=concat('{"triggered_by": "cron", "time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);