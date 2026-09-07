-- Re-create complete_batch using the new clean enums
CREATE OR REPLACE FUNCTION public.complete_batch(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg RECORD;
  today_lagos date;
  machine_count int;
  naira_per_batch_for_user numeric;
  task_row RECORD;
  total_today int;
  was_first_batch_ever boolean := false;
  referrer_uuid uuid;
  referrer_code text;
  new_pending numeric;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing user');
  END IF;

  SELECT
    task_batches_per_day,
    task_taps_per_batch,
    task_naira_per_batch,
    task_enabled
  INTO cfg
  FROM public.platform_config WHERE id = 1;

  IF NOT cfg.task_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'task_disabled');
  END IF;

  today_lagos := (now() AT TIME ZONE 'Africa/Lagos')::date;

  SELECT COUNT(*) INTO machine_count FROM public.spots WHERE user_id = _user_id AND status = 'active';
  IF machine_count < 1 THEN machine_count := 1; END IF;
  naira_per_batch_for_user := cfg.task_naira_per_batch * machine_count;

  -- Lock today's row (or create it)
  INSERT INTO public.daily_task (user_id, task_date, batches_done, bonus_batches)
  VALUES (_user_id, today_lagos, 0, 0)
  ON CONFLICT (user_id, task_date) DO NOTHING;

  SELECT * INTO task_row
  FROM public.daily_task
  WHERE user_id = _user_id AND task_date = today_lagos
  FOR UPDATE;

  total_today := cfg.task_batches_per_day + task_row.bonus_batches;

  IF task_row.batches_done >= total_today THEN
    RETURN jsonb_build_object('success', false, 'error', 'limit_reached', 'batches_done', task_row.batches_done, 'total_batches_today', total_today);
  END IF;

  -- Detect first batch ever for this user (any day)
  IF task_row.batches_done = 0 THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.daily_task
      WHERE user_id = _user_id AND batches_done > 0
    ) INTO was_first_batch_ever;
  END IF;

  -- Increment batches
  UPDATE public.daily_task
  SET batches_done = batches_done + 1
  WHERE user_id = _user_id AND task_date = today_lagos;

  -- Credit pending balance (direct write — trigger does not touch pending_balance)
  UPDATE public.cached_balances
  SET pending_balance = COALESCE(pending_balance, 0) + naira_per_batch_for_user,
      last_updated = now()
  WHERE user_id = _user_id;

  IF NOT FOUND THEN
    INSERT INTO public.cached_balances (user_id, deposit_balance, earnings_balance, pending_balance, last_updated)
    VALUES (_user_id, 0, 0, naira_per_batch_for_user, now());
  END IF;

  SELECT pending_balance INTO new_pending FROM public.cached_balances WHERE user_id = _user_id;

  -- Activity log entry
  INSERT INTO public.transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES (
    _user_id,
    'pending'::wallet_type,
    naira_per_batch_for_user,
    'task_earning'::transaction_type,
    'Daily task batch reward',
    'completed'::transaction_status,
    jsonb_build_object(
      'task_date', today_lagos,
      'batch_number', task_row.batches_done + 1,
      'machine_count', machine_count,
      'naira_per_batch', naira_per_batch_for_user
    )
  );

  -- Grant referrer bonus on user's first batch ever
  IF was_first_batch_ever THEN
    SELECT referred_by_code INTO referrer_code FROM public.profiles WHERE id = _user_id;
    IF referrer_code IS NOT NULL AND referrer_code <> '' THEN
      SELECT id INTO referrer_uuid FROM public.profiles WHERE referral_code = referrer_code LIMIT 1;
      IF referrer_uuid IS NOT NULL AND referrer_uuid <> _user_id THEN
        PERFORM public.grant_referral_bonus_batches(referrer_uuid, _user_id);
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'batches_done', task_row.batches_done + 1,
    'bonus_batches', task_row.bonus_batches,
    'total_batches_today', total_today,
    'naira_added', naira_per_batch_for_user,
    'pending_balance', new_pending,
    'was_first_batch_ever', was_first_batch_ever
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_batch(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_batch(uuid) TO service_role;


-- Re-create promote_pending_to_withdrawable using clean enum
CREATE OR REPLACE FUNCTION public.promote_pending_to_withdrawable(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amt numeric;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing user');
  END IF;

  SELECT COALESCE(pending_balance, 0) INTO amt
  FROM public.cached_balances
  WHERE user_id = _user_id
  FOR UPDATE;

  IF amt IS NULL OR amt <= 0 THEN
    RETURN jsonb_build_object('success', true, 'promoted', 0);
  END IF;

  -- Zero out pending; the trigger on transactions will recompute earnings_balance from history
  UPDATE public.cached_balances
  SET pending_balance = 0,
      last_updated = now()
  WHERE user_id = _user_id;

  -- Insert the earnings credit; trigger will add it to earnings_balance via recompute
  INSERT INTO public.transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES (
    _user_id,
    'earnings'::wallet_type,
    amt,
    'task_unlock'::transaction_type,
    'Pending unlocked into earnings (drop payout)',
    'completed'::transaction_status,
    jsonb_build_object('source', 'promote_pending_to_withdrawable', 'amount', amt)
  );

  RETURN jsonb_build_object('success', true, 'promoted', amt);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.promote_pending_to_withdrawable(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_pending_to_withdrawable(uuid) TO service_role;