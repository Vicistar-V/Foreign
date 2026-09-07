DO $$
DECLARE
  target_id uuid := '45b159e8-b91e-465a-ba6b-dac0ff29cb68';
BEGIN
  DELETE FROM public.drops WHERE spot_id IN (SELECT id FROM public.spots WHERE user_id = target_id);
  DELETE FROM public.spots WHERE user_id = target_id;
  DELETE FROM public.harvest_warnings WHERE user_id = target_id;
  DELETE FROM public.daily_task WHERE user_id = target_id;
  DELETE FROM public.referral_bonus_grants WHERE referrer_id = target_id OR referee_id = target_id;
  DELETE FROM public.payment_attempts WHERE user_id = target_id;
  DELETE FROM public.transactions WHERE user_id = target_id;
  DELETE FROM public.notifications WHERE user_id = target_id;
  DELETE FROM public.cached_balances WHERE user_id = target_id;
  DELETE FROM public.withdrawal_accounts WHERE user_id = target_id;
  DELETE FROM public.ticket_messages WHERE sender_id = target_id OR ticket_id IN (SELECT id FROM public.support_tickets WHERE user_id = target_id);
  DELETE FROM public.support_tickets WHERE user_id = target_id;
  DELETE FROM public.user_activity_log WHERE user_id = target_id;
  DELETE FROM public.user_tour_progress WHERE user_id = target_id;
  DELETE FROM public.user_roles WHERE user_id = target_id;
  DELETE FROM public.comparison_seen_log WHERE user_id = target_id;
  DELETE FROM public.comparison_broken_reports WHERE reporter_id = target_id;
  DELETE FROM public.profiles WHERE id = target_id;
  DELETE FROM auth.users WHERE id = target_id;
END $$;