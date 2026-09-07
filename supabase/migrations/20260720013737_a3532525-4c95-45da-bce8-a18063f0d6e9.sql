
CREATE OR REPLACE FUNCTION public.admin_delete_user(
  _user_id uuid,
  _confirm_admin_delete boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_name text;
  v_was_member boolean;
  v_target_is_admin boolean;
  v_is_self boolean;
  v_remaining_admins int;
BEGIN
  IF v_caller IS NULL OR NOT public.has_role(v_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User id required';
  END IF;

  v_is_self := (_user_id = v_caller);
  v_target_is_admin := public.has_role(_user_id, 'admin'::app_role);

  -- High-risk delete (self OR another admin) requires the second confirmation
  IF (v_is_self OR v_target_is_admin) AND NOT COALESCE(_confirm_admin_delete, false) THEN
    RAISE EXCEPTION 'ADMIN_CONFIRM_REQUIRED'
      USING HINT = 'Extra confirmation is required to delete an admin account.';
  END IF;

  -- Never allow removing the very last admin — the platform would be locked out
  IF v_target_is_admin THEN
    SELECT COUNT(DISTINCT user_id) INTO v_remaining_admins
    FROM public.user_roles
    WHERE role = 'admin'::app_role
      AND user_id <> _user_id;
    IF COALESCE(v_remaining_admins, 0) = 0 THEN
      RAISE EXCEPTION 'LAST_ADMIN_BLOCK'
        USING HINT = 'You cannot delete the last remaining admin account.';
    END IF;
  END IF;

  SELECT full_name, COALESCE(is_member, false) INTO v_name, v_was_member
  FROM public.profiles WHERE id = _user_id;

  IF v_name IS NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

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
    'was_member', v_was_member,
    'was_admin', v_target_is_admin,
    'was_self', v_is_self
  );
END;
$function$;
