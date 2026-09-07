-- P0-1: race in complete_batch lets pending overshoot cap. Fix with pg_advisory_xact_lock.
-- P0-2: cap math should use drop_target_amount (ticket target) not drop_profit_amount.
-- P2-8: get_daily_task can_do_more should be false when user has zero spots.

CREATE OR REPLACE FUNCTION public.complete_batch(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cfg RECORD;
  today_utc date;
  spot_count int;
  naira_per_batch_for_user numeric;
  task_row RECORD;
  total_today int;
  new_batches_done int;
  base_batches_per_day int;
  unlimited boolean;
  referrer_uuid uuid;
  referrer_code text;
  new_pending numeric;
  pending numeric;
  cap numeric;
  cap_per_spot numeric;
  just_completed_full_set boolean := false;
  has_prior_full_set boolean := false;
BEGIN
  IF _user_id IS NULL THEN RETURN jsonb_build_object('success',false,'error','missing user'); END IF;

  PERFORM pg_advisory_xact_lock(hashtext('complete_batch:' || _user_id::text));

  SELECT task_batches_per_day, task_taps_per_batch, task_naira_per_batch,
         task_enabled, drop_target_amount, drop_profit_amount, drop_entry_fee
    INTO cfg FROM public.platform_config WHERE id = 1;

  IF NOT cfg.task_enabled THEN
    RETURN jsonb_build_object('success',false,'error','task_disabled');
  END IF;

  today_utc := (now() AT TIME ZONE 'UTC')::date;

  SELECT COUNT(*) INTO spot_count FROM public.spots
    WHERE user_id = _user_id AND status = 'active';
  IF spot_count < 1 THEN
    RETURN jsonb_build_object('success',false,'error','no_active_spot');
  END IF;

  naira_per_batch_for_user := cfg.task_naira_per_batch;
  base_batches_per_day := cfg.task_batches_per_day;
  unlimited := (base_batches_per_day = 0);

  cap_per_spot := COALESCE(NULLIF(cfg.drop_target_amount, 0), cfg.drop_profit_amount);
  pending := public.get_pending_balance(_user_id);
  cap := cap_per_spot * spot_count;

  IF cap > 0 AND pending + naira_per_batch_for_user > cap THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'capacity_full',
      'pending', pending,
      'cap', cap,
      'extension_spot_price', cfg.drop_entry_fee,
      'payout_per_spot', cap_per_spot
    );
  END IF;

  INSERT INTO public.daily_task (user_id, task_date, batches_done, bonus_batches)
    VALUES (_user_id, today_utc, 0, 0)
    ON CONFLICT (user_id, task_date) DO NOTHING;
  SELECT * INTO task_row FROM public.daily_task
    WHERE user_id=_user_id AND task_date=today_utc FOR UPDATE;

  IF NOT unlimited THEN
    total_today := base_batches_per_day + task_row.bonus_batches;
    IF task_row.batches_done >= total_today THEN
      RETURN jsonb_build_object(
        'success',false,'error','limit_reached',
        'batches_done',task_row.batches_done,'total_batches_today',total_today
      );
    END IF;
  ELSE
    total_today := 0;
  END IF;

  new_batches_done := task_row.batches_done + 1;
  UPDATE public.daily_task SET batches_done = new_batches_done
    WHERE user_id=_user_id AND task_date=today_utc;

  INSERT INTO public.transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES (_user_id,'pending'::wallet_type, naira_per_batch_for_user,
          'task_earning'::transaction_type,
          'Daily task earnings','completed'::transaction_status,
          jsonb_build_object('task_date',today_utc,'batch_number',new_batches_done,
            'spot_count',spot_count,'naira_per_batch',naira_per_batch_for_user,
            'unlimited', unlimited));
  new_pending := public.get_pending_balance(_user_id);

  IF NOT unlimited AND new_batches_done >= base_batches_per_day THEN
    SELECT EXISTS (
      SELECT 1 FROM public.daily_task
      WHERE user_id = _user_id AND task_date < today_utc
        AND batches_done >= base_batches_per_day
    ) INTO has_prior_full_set;

    just_completed_full_set := NOT has_prior_full_set
      AND task_row.batches_done < base_batches_per_day
      AND new_batches_done >= base_batches_per_day;

    IF just_completed_full_set THEN
      SELECT referred_by_code INTO referrer_code FROM public.profiles WHERE id=_user_id;
      IF referrer_code IS NOT NULL AND referrer_code <> '' THEN
        SELECT id INTO referrer_uuid FROM public.profiles WHERE referral_code=referrer_code LIMIT 1;
        IF referrer_uuid IS NOT NULL AND referrer_uuid <> _user_id THEN
          PERFORM public.grant_referral_bonus_batches(referrer_uuid, _user_id);
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success',true,
    'batches_done',new_batches_done,
    'bonus_batches',task_row.bonus_batches,
    'total_batches_today',total_today,
    'unlimited', unlimited,
    'naira_added',naira_per_batch_for_user,
    'pending_balance',new_pending,
    'pending_cap', cap,
    'completed_full_set_today', just_completed_full_set
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_daily_task(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cfg RECORD;
  today_utc date;
  task_row RECORD;
  spot_count int;
  naira_per_batch_for_user numeric;
  pending numeric;
  cap numeric;
  cap_per_spot numeric;
  total_today int;
  batches_done_val int;
  bonus_batches_val int;
  capacity_full boolean;
  unlimited boolean;
  has_spots boolean;
  result jsonb;
BEGIN
  IF _user_id IS NULL THEN RETURN jsonb_build_object('success',false,'error','missing user'); END IF;

  SELECT task_batches_per_day, task_taps_per_batch, task_naira_per_batch,
         task_referral_bonus_batches, task_loader_seconds, task_enabled,
         referral_cash_bonus, referral_pending_bonus,
         drop_target_amount, drop_profit_amount, drop_entry_fee
    INTO cfg FROM public.platform_config WHERE id = 1;

  today_utc := (now() AT TIME ZONE 'UTC')::date;

  SELECT COUNT(*) INTO spot_count FROM public.spots
   WHERE user_id = _user_id AND status = 'active';
  has_spots := spot_count > 0;

  naira_per_batch_for_user := cfg.task_naira_per_batch;
  unlimited := (cfg.task_batches_per_day = 0);
  cap_per_spot := COALESCE(NULLIF(cfg.drop_target_amount, 0), cfg.drop_profit_amount);

  SELECT batches_done, bonus_batches INTO task_row FROM public.daily_task
    WHERE user_id = _user_id AND task_date = today_utc;
  IF task_row IS NULL THEN
    batches_done_val := 0; bonus_batches_val := 0;
  ELSE
    batches_done_val := task_row.batches_done;
    bonus_batches_val := task_row.bonus_batches;
  END IF;

  total_today := CASE WHEN unlimited THEN 0 ELSE cfg.task_batches_per_day + bonus_batches_val END;
  pending := public.get_pending_balance(_user_id);
  cap := cap_per_spot * GREATEST(spot_count, 0);
  capacity_full := (cap > 0 AND pending + naira_per_batch_for_user > cap);

  result := jsonb_build_object(
    'success', true,
    'today', today_utc,
    'task_enabled', cfg.task_enabled,
    'batches_done', batches_done_val,
    'bonus_batches', bonus_batches_val,
    'batches_per_day', cfg.task_batches_per_day,
    'unlimited', unlimited,
    'taps_per_batch', cfg.task_taps_per_batch,
    'naira_per_batch_for_user', naira_per_batch_for_user,
    'naira_per_batch_base', cfg.task_naira_per_batch,
    'machine_count', spot_count,
    'spot_count', spot_count,
    'total_batches_today', total_today,
    'can_do_more', cfg.task_enabled
                    AND has_spots
                    AND (unlimited OR batches_done_val < total_today)
                    AND (cap = 0 OR NOT capacity_full),
    'loader_seconds', cfg.task_loader_seconds,
    'referral_bonus_batches', cfg.task_referral_bonus_batches,
    'referral_cash_bonus', cfg.referral_cash_bonus,
    'referral_pending_bonus', cfg.referral_pending_bonus,
    'pending_balance', pending,
    'pending_cap', cap,
    'capacity_full', capacity_full,
    'extension_spot_price', cfg.drop_entry_fee,
    'payout_per_spot', cap_per_spot
  );

  IF capacity_full THEN
    result := result || jsonb_build_object(
      'message', 'Your basket is full. Buy another spot to keep earning.'
    );
  END IF;

  RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.pay_referrer_activation_bonus(_referee_id uuid, _referred_by_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_referrer_id UUID;
  v_cash_amount NUMERIC;
  v_pending_bump_configured NUMERIC;
  v_pending_bump_actual NUMERIC;
  v_referee_name TEXT;
  v_already_paid BOOLEAN;
  v_already_bumped BOOLEAN;
  v_referrer_spots INT;
  v_referrer_cap NUMERIC;
  v_referrer_pending NUMERIC;
  v_room NUMERIC;
  v_cap_per_spot NUMERIC;
BEGIN
  IF _referred_by_code IS NULL OR _referred_by_code = '' OR _referred_by_code = 'SYSTEM' THEN RETURN; END IF;
  SELECT id INTO v_referrer_id FROM profiles WHERE referral_code = _referred_by_code;
  IF v_referrer_id IS NULL OR v_referrer_id = _referee_id THEN RETURN; END IF;

  SELECT referral_cash_bonus, referral_pending_bonus,
         COALESCE(NULLIF(drop_target_amount, 0), drop_profit_amount)
    INTO v_cash_amount, v_pending_bump_configured, v_cap_per_spot
    FROM platform_config WHERE id = 1;

  SELECT full_name INTO v_referee_name FROM profiles WHERE id = _referee_id;

  IF v_cash_amount IS NOT NULL AND v_cash_amount > 0 THEN
    SELECT EXISTS(
      SELECT 1 FROM transactions
      WHERE user_id = v_referrer_id
        AND transaction_type = 'referral_payout'
        AND wallet_type = 'earnings'
        AND metadata->>'referee_id' = _referee_id::text
        AND metadata->>'paid_on' = 'activation'
    ) INTO v_already_paid;

    IF NOT v_already_paid THEN
      INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
      VALUES (
        v_referrer_id, 'earnings', v_cash_amount, 'referral_payout',
        format('Referral bonus - %s activated', COALESCE(v_referee_name, 'your friend')),
        'completed',
        jsonb_build_object('referee_id', _referee_id, 'referee_name', v_referee_name, 'paid_on', 'activation')
      );
    END IF;
  END IF;

  IF v_pending_bump_configured IS NOT NULL AND v_pending_bump_configured > 0 THEN
    SELECT EXISTS(
      SELECT 1 FROM transactions
      WHERE user_id = v_referrer_id
        AND transaction_type = 'task_earning'
        AND wallet_type = 'pending'
        AND metadata->>'source' = 'referral_pending_bump'
        AND metadata->>'referee_id' = _referee_id::text
    ) INTO v_already_bumped;

    IF NOT v_already_bumped THEN
      PERFORM pg_advisory_xact_lock(hashtext('complete_batch:' || v_referrer_id::text));

      SELECT COUNT(*) INTO v_referrer_spots FROM spots
        WHERE user_id = v_referrer_id AND status = 'active';

      IF v_referrer_spots > 0 THEN
        v_referrer_cap := v_cap_per_spot * v_referrer_spots;
        v_referrer_pending := public.get_pending_balance(v_referrer_id);
        v_room := GREATEST(v_referrer_cap - v_referrer_pending, 0);
        v_pending_bump_actual := LEAST(v_pending_bump_configured, v_room);

        IF v_pending_bump_actual > 0 THEN
          INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
          VALUES (
            v_referrer_id, 'pending', v_pending_bump_actual, 'task_earning',
            format('Referral shortcut - %s activated', COALESCE(v_referee_name, 'your friend')),
            'completed',
            jsonb_build_object(
              'source', 'referral_pending_bump',
              'referee_id', _referee_id,
              'referee_name', v_referee_name,
              'configured_amount', v_pending_bump_configured,
              'actual_amount', v_pending_bump_actual,
              'reason', CASE WHEN v_pending_bump_actual < v_pending_bump_configured THEN 'capped_at_room' ELSE 'full' END
            )
          );
        END IF;
      END IF;
    END IF;
  END IF;

  IF NOT COALESCE(v_already_paid, true) OR NOT COALESCE(v_already_bumped, true) THEN
    PERFORM create_notification(
      _user_id := v_referrer_id,
      _type := 'referral_bonus_paid',
      _title := format('%s just activated!', COALESCE(v_referee_name, 'Your friend')),
      _message := CASE
        WHEN COALESCE(v_pending_bump_actual, 0) > 0 THEN
          format('₦%s cash added to your earnings + ₦%s jumped into your pending balance. Your line just got shorter.',
            v_cash_amount, v_pending_bump_actual)
        ELSE
          format('₦%s added to your earnings balance.', v_cash_amount)
        END,
      _metadata := jsonb_build_object(
        'referee_id', _referee_id,
        'cash_amount', v_cash_amount,
        'pending_bump', COALESCE(v_pending_bump_actual, 0)
      )::jsonb,
      _link := '/wallet'
    );
  END IF;
END;
$function$;