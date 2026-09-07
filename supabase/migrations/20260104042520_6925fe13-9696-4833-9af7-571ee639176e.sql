-- Unschedule the daily-drop-manager cron job by job ID
SELECT cron.unschedule(1);