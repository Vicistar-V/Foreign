
CREATE OR REPLACE FUNCTION public.get_daily_task(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE cfg RECORD; today_utc date; task_row RECORD; machine_count int;
  naira_per_batch_for_user numeric; pending numeric; total_today int;
  batches_done_val int; bonus_batches_val int;
BEGIN
  IF _user_id IS NULL THEN RETURN jsonb_build_object('success',false,'error','missing user'); END IF;
  SELECT task_batches_per_day, task_taps_per_batch, task_naira_per_batch,
    task_referral_bonus_batches, task_loader_seconds, task_enabled, referral_cash_bonus
    INTO cfg FROM public.platform_config WHERE id=1;
  today_utc := (now() AT TIME ZONE 'UTC')::date;
  SELECT COUNT(*) INTO machine_count FROM public.spots WHERE user_id=_user_id AND status='active';
  IF machine_count < 1 THEN machine_count := 1; END IF;
  -- Spot multiplier: each batch pays base × number of active spots
  naira_per_batch_for_user := cfg.task_naira_per_batch * machine_count;
  SELECT batches_done, bonus_batches INTO task_row FROM public.daily_task
    WHERE user_id=_user_id AND task_date=today_utc;
  IF task_row IS NULL THEN batches_done_val := 0; bonus_batches_val := 0;
  ELSE batches_done_val := task_row.batches_done; bonus_batches_val := task_row.bonus_batches;
  END IF;
  total_today := cfg.task_batches_per_day + bonus_batches_val;
  pending := public.get_pending_balance(_user_id);
  RETURN jsonb_build_object('success',true,'today',today_utc,'task_enabled',cfg.task_enabled,
    'batches_done',batches_done_val,'bonus_batches',bonus_batches_val,
    'batches_per_day',cfg.task_batches_per_day,'taps_per_batch',cfg.task_taps_per_batch,
    'naira_per_batch_for_user',naira_per_batch_for_user,'naira_per_batch_base',cfg.task_naira_per_batch,
    'machine_count',machine_count,'spot_count',machine_count,'total_batches_today',total_today,
    'can_do_more',cfg.task_enabled AND batches_done_val < total_today,
    'loader_seconds',cfg.task_loader_seconds,'referral_bonus_batches',cfg.task_referral_bonus_batches,
    'referral_cash_bonus',cfg.referral_cash_bonus,'pending_balance',pending);
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_batch(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE cfg RECORD; today_utc date; machine_count int; naira_per_batch_for_user numeric;
  task_row RECORD; total_today int; new_batches_done int;
  base_batches_per_day int; just_completed_full_set boolean := false;
  has_prior_full_set boolean := false;
  referrer_uuid uuid; referrer_code text; new_pending numeric;
BEGIN
  IF _user_id IS NULL THEN RETURN jsonb_build_object('success',false,'error','missing user'); END IF;
  SELECT task_batches_per_day, task_taps_per_batch, task_naira_per_batch, task_enabled
    INTO cfg FROM public.platform_config WHERE id = 1;
  IF NOT cfg.task_enabled THEN RETURN jsonb_build_object('success',false,'error','task_disabled'); END IF;
  today_utc := (now() AT TIME ZONE 'UTC')::date;
  SELECT COUNT(*) INTO machine_count FROM public.spots WHERE user_id=_user_id AND status='active';
  IF machine_count < 1 THEN machine_count := 1; END IF;
  -- Spot multiplier: each batch pays base × number of active spots
  naira_per_batch_for_user := cfg.task_naira_per_batch * machine_count;
  base_batches_per_day := cfg.task_batches_per_day;
  INSERT INTO public.daily_task (user_id, task_date, batches_done, bonus_batches)
    VALUES (_user_id, today_utc, 0, 0) ON CONFLICT (user_id, task_date) DO NOTHING;
  SELECT * INTO task_row FROM public.daily_task
    WHERE user_id=_user_id AND task_date=today_utc FOR UPDATE;
  total_today := base_batches_per_day + task_row.bonus_batches;
  IF task_row.batches_done >= total_today THEN
    RETURN jsonb_build_object('success',false,'error','limit_reached','batches_done',task_row.batches_done,'total_batches_today',total_today);
  END IF;

  new_batches_done := task_row.batches_done + 1;

  UPDATE public.daily_task SET batches_done = new_batches_done
    WHERE user_id=_user_id AND task_date=today_utc;
  INSERT INTO public.transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES (_user_id,'pending'::wallet_type, naira_per_batch_for_user, 'task_earning'::transaction_type,
    'Daily task earnings','completed'::transaction_status,
    jsonb_build_object('task_date',today_utc,'batch_number',new_batches_done,
      'machine_count',machine_count,'naira_per_batch',naira_per_batch_for_user));
  new_pending := public.get_pending_balance(_user_id);

  IF new_batches_done >= base_batches_per_day THEN
    SELECT EXISTS (
      SELECT 1 FROM public.daily_task
      WHERE user_id = _user_id
        AND task_date < today_utc
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

  RETURN jsonb_build_object('success',true,'batches_done',new_batches_done,
    'bonus_batches',task_row.bonus_batches,'total_batches_today',total_today,
    'naira_added',naira_per_batch_for_user,'pending_balance',new_pending,
    'completed_full_set_today', just_completed_full_set);
END;
$function$;
