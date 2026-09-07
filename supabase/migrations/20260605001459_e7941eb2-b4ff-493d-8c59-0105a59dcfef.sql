
CREATE OR REPLACE FUNCTION public.admin_wipe_unactivated_users()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_ids uuid[];
  v_count int;
BEGIN
  IF v_caller IS NULL OR NOT public.has_role(v_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  SELECT array_agg(id) INTO v_ids
  FROM public.profiles
  WHERE COALESCE(is_member, false) = false;

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', true, 'deleted_count', 0);
  END IF;

  v_count := array_length(v_ids, 1);

  -- Clean up public tables that reference users (no cascade defined)
  DELETE FROM public.ticket_messages WHERE sender_id = ANY(v_ids);
  DELETE FROM public.support_tickets WHERE user_id = ANY(v_ids);
  DELETE FROM public.referral_bonus_grants WHERE referee_id = ANY(v_ids) OR referrer_id = ANY(v_ids);
  DELETE FROM public.withdrawal_accounts WHERE user_id = ANY(v_ids);
  DELETE FROM public.user_tour_progress WHERE user_id = ANY(v_ids);
  DELETE FROM public.user_roles WHERE user_id = ANY(v_ids);
  DELETE FROM public.user_activity_log WHERE user_id = ANY(v_ids);
  DELETE FROM public.daily_task WHERE user_id = ANY(v_ids);
  DELETE FROM public.payment_attempts WHERE user_id = ANY(v_ids);
  DELETE FROM public.cached_balances WHERE user_id = ANY(v_ids);
  DELETE FROM public.harvest_warnings WHERE user_id = ANY(v_ids);
  DELETE FROM public.drop_pulses WHERE user_id = ANY(v_ids);
  DELETE FROM public.comparison_seen_log WHERE user_id = ANY(v_ids);
  DELETE FROM public.comparison_broken_reports WHERE user_id = ANY(v_ids);
  DELETE FROM public.drops WHERE spot_id IN (SELECT id FROM public.spots WHERE user_id = ANY(v_ids));
  DELETE FROM public.spots WHERE user_id = ANY(v_ids);
  DELETE FROM public.transactions WHERE user_id = ANY(v_ids);
  DELETE FROM public.notifications WHERE user_id = ANY(v_ids);
  DELETE FROM public.user_pin_secrets WHERE user_id = ANY(v_ids);

  -- Finally remove auth rows (cascade removes profiles)
  DELETE FROM auth.users WHERE id = ANY(v_ids);

  RETURN jsonb_build_object('success', true, 'deleted_count', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_wipe_unactivated_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_wipe_unactivated_users() TO authenticated, service_role;
