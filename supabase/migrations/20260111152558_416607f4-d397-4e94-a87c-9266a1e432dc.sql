-- Remove the viketa-drop-pulse cron job since we no longer use the pulse system
-- Distribution now happens immediately when spots are purchased (cascade effect)
SELECT cron.unschedule('viketa-drop-pulse');