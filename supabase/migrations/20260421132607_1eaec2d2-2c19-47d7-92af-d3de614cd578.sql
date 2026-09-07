-- STEP 1: Preserve calibration streak data on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS calibration_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_calibration_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_calibration_date date;

UPDATE public.profiles p
SET
  calibration_streak = COALESCE(ug.calibration_streak, 0),
  longest_calibration_streak = COALESCE(ug.longest_calibration_streak, 0),
  last_calibration_date = ug.last_calibration_date
FROM public.user_gamification ug
WHERE ug.user_id = p.id;

-- STEP 2: Unschedule cron jobs
DO $$
DECLARE
  job_rec RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    FOR job_rec IN
      SELECT jobname FROM cron.job
      WHERE command ILIKE '%distribute-leaderboard-prizes%'
         OR command ILIKE '%claim-streak-reward%'
         OR command ILIKE '%get-leaderboard%'
         OR command ILIKE '%spin-wheel%'
         OR command ILIKE '%get-gamification-status%'
         OR command ILIKE '%get-games-stats%'
         OR command ILIKE '%review-mission%'
    LOOP
      PERFORM cron.unschedule(job_rec.jobname);
    END LOOP;
  END IF;
END $$;

-- STEP 3: Drop RPC functions
DROP FUNCTION IF EXISTS public.claim_streak_reward(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.claim_streak_reward(integer, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.update_user_streak(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.check_daily_spin_eligible(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.deduct_lucky_spin_cost(uuid, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.deduct_lucky_spin_cost(numeric, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.record_spin_result(uuid, text, text, numeric, text) CASCADE;
DROP FUNCTION IF EXISTS public.record_spin_result(text, text, numeric, text, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_weekly_leaderboard(text) CASCADE;
DROP FUNCTION IF EXISTS public.can_complete_mission(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.check_nudge_daily_limit(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.claim_lead_generator_reward(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_mission_stats(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_task_approved_count(uuid) CASCADE;

-- STEP 4: Drop tables
DROP TABLE IF EXISTS public.spin_results CASCADE;
DROP TABLE IF EXISTS public.leaderboard_snapshots CASCADE;
DROP TABLE IF EXISTS public.mission_completions CASCADE;
DROP TABLE IF EXISTS public.missions CASCADE;
DROP TABLE IF EXISTS public.user_gamification CASCADE;

-- STEP 5: Drop enums
DROP TYPE IF EXISTS public.mission_status CASCADE;
DROP TYPE IF EXISTS public.mission_type CASCADE;

-- STEP 6: Drop unused columns from platform_config
ALTER TABLE public.platform_config
  DROP COLUMN IF EXISTS lucky_spin_enabled,
  DROP COLUMN IF EXISTS lucky_spin_cost,
  DROP COLUMN IF EXISTS daily_spin_enabled,
  DROP COLUMN IF EXISTS streak_rewards_enabled,
  DROP COLUMN IF EXISTS leaderboard_enabled,
  DROP COLUMN IF EXISTS leaderboard_prize_1,
  DROP COLUMN IF EXISTS leaderboard_prize_2,
  DROP COLUMN IF EXISTS leaderboard_prize_3,
  DROP COLUMN IF EXISTS leaderboard_prize_others;

-- STEP 7: Drop task-media storage policies (bucket itself dropped via Storage API)
DROP POLICY IF EXISTS "Users can upload mission proof" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own mission proof" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all mission proof" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage task media" ON storage.objects;
DROP POLICY IF EXISTS "task-media public read" ON storage.objects;
DROP POLICY IF EXISTS "task-media authenticated upload" ON storage.objects;