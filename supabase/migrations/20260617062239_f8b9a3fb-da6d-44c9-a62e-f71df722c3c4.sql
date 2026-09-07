CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_name text;
  v_was_member boolean;
BEGIN
  IF v_caller IS NULL OR NOT public.has_role(v_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User id required';
  END IF;

  IF _user_id = v_caller THEN
    RAISE EXCEPTION 'You cannot delete your own admin account';
  END IF;

  SELECT full_name, COALESCE(is_member, false) INTO v_name, v_was_member
  FROM public.profiles WHERE id = _user_id;

  IF v_name IS NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Delete owned/related data (we keep system-level logs: webhook_logs,
  -- drop_fill_audit_log, drop_pulses, system_alerts, admin_notifications)
  DELETE FROM public.ticket_messages WHERE sender_id = _user_id;
  DELETE FROM public.support_tickets WHERE user_id = _user_id;
  DELETE FROM public.referral_bonus_grants WHERE referee_id = _user_id OR referrer_id = _user_id;
  DELETE FROM public.withdrawal_accounts WHERE user_id = _user_id;
  DELETE FROM public.user_tour_progress WHERE user_id = _user_id;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.user_activity_log WHERE user_id = _user_id;
  DELETE FROM public.daily_task WHERE user_id = _user_id;
  DELETE FROM public.payment_attempts WHERE user_id = _user_id;
  DELETE FROM public.cached_balances WHERE user_id = _user_id;
  DELETE FROM public.harvest_warnings WHERE user_id = _user_id;
  DELETE FROM public.comparison_seen_log WHERE user_id = _user_id;
  DELETE FROM public.comparison_broken_reports WHERE reporter_id = _user_id;
  DELETE FROM public.drops WHERE spot_id IN (SELECT id FROM public.spots WHERE user_id = _user_id);
  DELETE FROM public.spots WHERE user_id = _user_id;
  DELETE FROM public.transactions WHERE user_id = _user_id;
  DELETE FROM public.notifications WHERE user_id = _user_id;
  DELETE FROM public.user_pin_secrets WHERE user_id = _user_id;
  DELETE FROM public.profiles WHERE id = _user_id;
  DELETE FROM auth.users WHERE id = _user_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_user_id', _user_id,
    'deleted_user_name', v_name,
    'was_member', v_was_member
  );
END;
$function$;