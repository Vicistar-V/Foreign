-- ============================================================
-- Migration B: Daily Task RPCs
-- ============================================================

-- 1) get_daily_task: read today's state for a user
CREATE OR REPLACE FUNCTION public.get_daily_task(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg RECORD;
  today_lagos date;
  task_row RECORD;
  machine_count int;
  naira_per_batch_for_user numeric;
  pending numeric;
  total_today int;
  batches_done_val int;
  bonus_batches_val int;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing user');
  END IF;

  SELECT
    task_batches_per_day,
    task_taps_per_batch,
    task_naira_per_batch,
    task_referral_bonus_batches,
    task_loader_seconds,
    task_enabled,
    referral_cash_bonus
  INTO cfg
  FROM public.platform_config
  WHERE id = 1;

  today_lagos := (now() AT TIME ZONE 'Africa/Lagos')::date;

  -- Active spot count (min 1)
  SELECT COUNT(*) INTO machine_count
  FROM public.spots
  WHERE user_id = _user_id AND status = 'active';
  IF machine_count < 1 THEN machine_count := 1; END IF;

  naira_per_batch_for_user := cfg.task_naira_per_batch * machine_count;

  -- Read current task row (do not create here; created on first complete_batch)
  SELECT batches_done, bonus_batches
  INTO task_row
  FROM public.daily_task
  WHERE user_id = _user_id AND task_date = today_lagos;

  IF task_row IS NULL THEN
    batches_done_val := 0;
    bonus_batches_val := 0;
  ELSE
    batches_done_val := task_row.batches_done;
    bonus_batches_val := task_row.bonus_batches;
  END IF;

  total_today := cfg.task_batches_per_day + bonus_batches_val;

  SELECT COALESCE(pending_balance, 0) INTO pending
  FROM public.cached_balances
  WHERE user_id = _user_id;
  IF pending IS NULL THEN pending := 0; END IF;

  RETURN jsonb_build_object(
    'success', true,
    'today', today_lagos,
    'task_enabled', cfg.task_enabled,
    'batches_done', batches_done_val,
    'bonus_batches', bonus_batches_val,
    'batches_per_day', cfg.task_batches_per_day,
    'taps_per_batch', cfg.task_taps_per_batch,
    'naira_per_batch_for_user', naira_per_batch_for_user,
    'naira_per_batch_base', cfg.task_naira_per_batch,
    'machine_count', machine_count,
    'total_batches_today', total_today,
    'can_do_more', cfg.task_enabled AND batches_done_val < total_today,
    'loader_seconds', cfg.task_loader_seconds,
    'referral_bonus_batches', cfg.task_referral_bonus_batches,
    'referral_cash_bonus', cfg.referral_cash_bonus,
    'pending_balance', pending
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_daily_task(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_daily_task(uuid) TO authenticated, service_role;


-- 2) grant_referral_bonus_batches: internal helper, idempotent
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
  today_lagos date;
  bonus_amount int;
  inserted_grant boolean := false;
BEGIN
  IF _referrer_id IS NULL OR _referee_id IS NULL OR _referrer_id = _referee_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_ids');
  END IF;

  today_lagos := (now() AT TIME ZONE 'Africa/Lagos')::date;

  SELECT task_referral_bonus_batches INTO bonus_amount FROM public.platform_config WHERE id = 1;
  IF bonus_amount IS NULL OR bonus_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'bonus_disabled');
  END IF;

  -- Idempotency: try insert; if conflict (already granted today), exit no-op
  BEGIN
    INSERT INTO public.referral_bonus_grants (referrer_id, referee_id, grant_date, bonus_batches_granted)
    VALUES (_referrer_id, _referee_id, today_lagos, bonus_amount);
    inserted_grant := true;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', true, 'granted', false, 'reason', 'already_granted');
  END;

  -- Upsert today's daily_task for referrer and add bonus batches
  INSERT INTO public.daily_task (user_id, task_date, batches_done, bonus_batches)
  VALUES (_referrer_id, today_lagos, 0, bonus_amount)
  ON CONFLICT (user_id, task_date)
  DO UPDATE SET bonus_batches = public.daily_task.bonus_batches + EXCLUDED.bonus_batches;

  -- Notify referrer
  INSERT INTO public.notifications (user_id, notification_type, title, message, metadata)
  VALUES (
    _referrer_id,
    'task_bonus_granted',
    'Bonus batches unlocked',
    'A friend you invited completed their first batch. You got +' || bonus_amount || ' bonus batches today.',
    jsonb_build_object('referee_id', _referee_id, 'bonus_batches', bonus_amount, 'date', today_lagos)
  );

  RETURN jsonb_build_object('success', true, 'granted', true, 'bonus_batches', bonus_amount);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grant_referral_bonus_batches(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_referral_bonus_batches(uuid, uuid) TO service_role;


-- 3) complete_batch: called by edge function after the loader finishes
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

  -- Credit pending balance
  UPDATE public.cached_balances
  SET pending_balance = COALESCE(pending_balance, 0) + naira_per_batch_for_user,
      last_updated = now()
  WHERE user_id = _user_id;

  -- If user has no cached_balances row yet, create one
  IF NOT FOUND THEN
    INSERT INTO public.cached_balances (user_id, deposit_balance, earnings_balance, pending_balance, last_updated)
    VALUES (_user_id, 0, 0, naira_per_batch_for_user, now());
  END IF;

  SELECT pending_balance INTO new_pending FROM public.cached_balances WHERE user_id = _user_id;

  -- Log a transaction in the pending wallet (cast properly)
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    -- enum may not exist yet; fall back to text values
    INSERT INTO public.transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
    VALUES (
      _user_id,
      'earnings'::wallet_type,
      0,
      'bonus'::transaction_type,
      'Daily task batch reward (logged in fallback mode)',
      'completed'::transaction_status,
      jsonb_build_object(
        'task_date', today_lagos,
        'pending_amount', naira_per_batch_for_user,
        'note', 'pending wallet enum not present; pending_balance still credited',
        'batch_number', task_row.batches_done + 1
      )
    );
  END;

  -- Grant referrer bonus on the user's first batch ever
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


-- 4) promote_pending_to_withdrawable: called by distribute-liquidity at payout time
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

  SELECT COALESCE(pending_balance, 0) INTO amt FROM public.cached_balances WHERE user_id = _user_id FOR UPDATE;

  IF amt IS NULL OR amt <= 0 THEN
    RETURN jsonb_build_object('success', true, 'promoted', 0);
  END IF;

  UPDATE public.cached_balances
  SET pending_balance = 0,
      earnings_balance = COALESCE(earnings_balance, 0) + amt,
      last_updated = now()
  WHERE user_id = _user_id;

  -- Record both legs as transactions for clean history
  INSERT INTO public.transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES (
    _user_id,
    'earnings'::wallet_type,
    amt,
    'bonus'::transaction_type,
    'Pending balance unlocked into earnings (drop payout)',
    'completed'::transaction_status,
    jsonb_build_object('source', 'promote_pending_to_withdrawable', 'amount', amt)
  );

  RETURN jsonb_build_object('success', true, 'promoted', amt);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.promote_pending_to_withdrawable(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_pending_to_withdrawable(uuid) TO service_role;