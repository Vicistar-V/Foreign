-- Update daily-drop-manager cron schedule from 15 minutes to 5 minutes
-- This allows distribution to trigger at 21:05 WAT instead of 21:15 WAT

SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'daily-drop-manager'),
  schedule := '*/5 * * * *'
);