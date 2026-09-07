CREATE OR REPLACE FUNCTION public.grant_referral_bonus_batches(
  _referrer_id uuid,
  _referee_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_utc date;
  bonus_amount int;
BEGIN
  IF _referrer_id IS NULL OR _referee_id IS NULL OR _referrer_id = _referee_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_ids');
  END IF;

  -- UTC everywhere to match complete_batch / daily_task rows
  today_utc := (now() AT TIME ZONE 'UTC')::date;

  SELECT task_referral_bonus_batches INTO bonus_amount FROM public.platform_config WHERE id = 1;
  IF bonus_amount IS NULL OR bonus_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'bonus_disabled');
  END IF;

  -- Idempotency: try insert; if conflict (already granted today), exit no-op
  BEGIN
    INSERT INTO public.referral_bonus_grants (referrer_id, referee_id, grant_date, bonus_batches_granted)
    VALUES (_referrer_id, _referee_id, today_utc, bonus_amount);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', true, 'granted', false, 'reason', 'already_granted');
  END;

  -- Upsert today's daily_task (UTC) for referrer and add bonus batches
  INSERT INTO public.daily_task (user_id, task_date, batches_done, bonus_batches)
  VALUES (_referrer_id, today_utc, 0, bonus_amount)
  ON CONFLICT (user_id, task_date)
  DO UPDATE SET bonus_batches = public.daily_task.bonus_batches + EXCLUDED.bonus_batches;

  -- Notify referrer
  INSERT INTO public.notifications (user_id, notification_type, title, message, metadata)
  VALUES (
    _referrer_id,
    'task_bonus_granted',
    'Bonus batches unlocked',
    'A friend you invited completed their first batch. You got +' || bonus_amount || ' bonus batches today.',
    jsonb_build_object('referee_id', _referee_id, 'bonus_batches', bonus_amount, 'date', today_utc)
  );

  RETURN jsonb_build_object('success', true, 'granted', true, 'bonus_batches', bonus_amount);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grant_referral_bonus_batches(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_referral_bonus_batches(uuid, uuid) TO service_role;