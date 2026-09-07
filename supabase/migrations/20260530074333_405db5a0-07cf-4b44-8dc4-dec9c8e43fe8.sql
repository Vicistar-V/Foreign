-- One-time cleanup: remove unactivated users (is_member=false) and ALL their data.
-- Explicit per user request. Order: dependents → profiles → auth.users.

DO $$
DECLARE
  victim_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO victim_ids
  FROM public.profiles
  WHERE is_member = false;

  IF victim_ids IS NULL OR array_length(victim_ids, 1) = 0 THEN
    RAISE NOTICE 'No unactivated users found.';
    RETURN;
  END IF;

  RAISE NOTICE 'Deleting % unactivated users and their data', array_length(victim_ids, 1);

  -- Wipe dependent rows (no FK cascade exists, so do it manually).
  DELETE FROM public.transactions               WHERE user_id = ANY(victim_ids);
  DELETE FROM public.payment_attempts           WHERE user_id = ANY(victim_ids);
  DELETE FROM public.cached_balances            WHERE user_id = ANY(victim_ids);
  DELETE FROM public.daily_task                 WHERE user_id = ANY(victim_ids);
  DELETE FROM public.spots                      WHERE user_id = ANY(victim_ids);
  DELETE FROM public.notifications              WHERE user_id = ANY(victim_ids);
  DELETE FROM public.user_activity_log          WHERE user_id = ANY(victim_ids);
  DELETE FROM public.user_pin_secrets           WHERE user_id = ANY(victim_ids);
  DELETE FROM public.user_roles                 WHERE user_id = ANY(victim_ids);
  DELETE FROM public.user_tour_progress         WHERE user_id = ANY(victim_ids);
  DELETE FROM public.withdrawal_accounts        WHERE user_id = ANY(victim_ids);
  DELETE FROM public.referral_bonus_grants      WHERE referee_id = ANY(victim_ids) OR referrer_id = ANY(victim_ids);
  DELETE FROM public.harvest_warnings           WHERE user_id = ANY(victim_ids);
  DELETE FROM public.comparison_seen_log        WHERE user_id = ANY(victim_ids);
  DELETE FROM public.comparison_broken_reports  WHERE reporter_id = ANY(victim_ids);
  DELETE FROM public.support_tickets            WHERE user_id = ANY(victim_ids);

  -- Profiles
  DELETE FROM public.profiles WHERE id = ANY(victim_ids);

  -- Finally the auth.users rows themselves
  DELETE FROM auth.users WHERE id = ANY(victim_ids);
END $$;