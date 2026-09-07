DO $$
DECLARE
  uid uuid := '86f8cbbe-0247-4d15-9335-9ea52fbf6bb3';
BEGIN
  -- drops attached to this user's spots
  DELETE FROM public.drops WHERE spot_id IN (SELECT id FROM public.spots WHERE user_id = uid);
  DELETE FROM public.spots WHERE user_id = uid;

  DELETE FROM public.daily_task WHERE user_id = uid;
  DELETE FROM public.transactions WHERE user_id = uid;
  DELETE FROM public.cached_balances WHERE user_id = uid;
  DELETE FROM public.payment_attempts WHERE user_id = uid;
  DELETE FROM public.withdrawal_accounts WHERE user_id = uid;
  DELETE FROM public.referral_bonus_grants WHERE referrer_id = uid OR referee_id = uid;
  DELETE FROM public.comparison_seen_log WHERE user_id = uid;
  DELETE FROM public.comparison_broken_reports WHERE reporter_id = uid;
  DELETE FROM public.notifications WHERE user_id = uid;
  DELETE FROM public.user_activity_log WHERE user_id = uid;
  DELETE FROM public.ticket_messages WHERE ticket_id IN (SELECT id FROM public.support_tickets WHERE user_id = uid);
  DELETE FROM public.ticket_messages WHERE sender_id = uid;
  DELETE FROM public.support_tickets WHERE user_id = uid;
  DELETE FROM public.user_roles WHERE user_id = uid;

  UPDATE public.profiles
  SET is_member = false,
      pin_hash = NULL,
      avatar_url = NULL,
      is_name_locked = false,
      is_banned = false,
      banned_at = NULL,
      banned_reason = NULL,
      auto_compound_enabled = false,
      last_payout_at = NULL,
      last_seen_at = now(),
      metadata = '{}'::jsonb
  WHERE id = uid;
END $$;