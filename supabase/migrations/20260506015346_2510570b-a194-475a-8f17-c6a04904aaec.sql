
-- 1) Update consume_pending_for_cycle wording
CREATE OR REPLACE FUNCTION public.consume_pending_for_cycle(_user_id uuid, _profit_target numeric, _spot_id uuid, _drop_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_available numeric; v_payable numeric;
BEGIN
  IF _user_id IS NULL OR _profit_target IS NULL OR _profit_target <= 0 THEN
    RETURN jsonb_build_object('paid', 0, 'target', COALESCE(_profit_target,0), 'forfeited', 0);
  END IF;
  PERFORM 1 FROM public.transactions
   WHERE user_id=_user_id AND wallet_type='pending'::wallet_type
     AND created_at >= date_trunc('day', (now() AT TIME ZONE 'UTC')) AT TIME ZONE 'UTC'
   FOR UPDATE;
  v_available := public.get_pending_balance(_user_id);
  v_payable := LEAST(_profit_target, v_available);
  IF v_payable <= 0 THEN
    RETURN jsonb_build_object('paid', 0, 'target', _profit_target, 'forfeited', _profit_target);
  END IF;
  INSERT INTO public.transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES (_user_id,'pending'::wallet_type,-v_payable,'task_unlock'::transaction_type,
    'Daily earnings applied to machine payout','completed'::transaction_status,
    jsonb_build_object('spot_id',_spot_id,'drop_id',_drop_id,'amount',v_payable));
  INSERT INTO public.transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES (_user_id,'earnings'::wallet_type,v_payable,'drop_profit'::transaction_type,
    'Machine payout (ready to withdraw)','completed'::transaction_status,
    jsonb_build_object('spot_id',_spot_id,'drop_id',_drop_id,'amount',v_payable,'target',_profit_target));
  RETURN jsonb_build_object('paid', v_payable, 'target', _profit_target, 'forfeited', _profit_target - v_payable);
END;
$function$;

-- 2) Update complete_batch wording
CREATE OR REPLACE FUNCTION public.complete_batch(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE cfg RECORD; today_utc date; machine_count int; naira_per_batch_for_user numeric;
  task_row RECORD; total_today int; was_first_batch_ever boolean := false;
  referrer_uuid uuid; referrer_code text; new_pending numeric;
BEGIN
  IF _user_id IS NULL THEN RETURN jsonb_build_object('success',false,'error','missing user'); END IF;
  SELECT task_batches_per_day, task_taps_per_batch, task_naira_per_batch, task_enabled
    INTO cfg FROM public.platform_config WHERE id = 1;
  IF NOT cfg.task_enabled THEN RETURN jsonb_build_object('success',false,'error','task_disabled'); END IF;
  today_utc := (now() AT TIME ZONE 'UTC')::date;
  SELECT COUNT(*) INTO machine_count FROM public.spots WHERE user_id=_user_id AND status='active';
  IF machine_count < 1 THEN machine_count := 1; END IF;
  naira_per_batch_for_user := cfg.task_naira_per_batch * machine_count;
  INSERT INTO public.daily_task (user_id, task_date, batches_done, bonus_batches)
    VALUES (_user_id, today_utc, 0, 0) ON CONFLICT (user_id, task_date) DO NOTHING;
  SELECT * INTO task_row FROM public.daily_task
    WHERE user_id=_user_id AND task_date=today_utc FOR UPDATE;
  total_today := cfg.task_batches_per_day + task_row.bonus_batches;
  IF task_row.batches_done >= total_today THEN
    RETURN jsonb_build_object('success',false,'error','limit_reached','batches_done',task_row.batches_done,'total_batches_today',total_today);
  END IF;
  IF task_row.batches_done = 0 THEN
    SELECT NOT EXISTS (SELECT 1 FROM public.daily_task WHERE user_id=_user_id AND batches_done>0)
      INTO was_first_batch_ever;
  END IF;
  UPDATE public.daily_task SET batches_done = batches_done + 1
    WHERE user_id=_user_id AND task_date=today_utc;
  INSERT INTO public.transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES (_user_id,'pending'::wallet_type, naira_per_batch_for_user, 'task_earning'::transaction_type,
    'Daily task earnings','completed'::transaction_status,
    jsonb_build_object('task_date',today_utc,'batch_number',task_row.batches_done+1,
      'machine_count',machine_count,'naira_per_batch',naira_per_batch_for_user));
  new_pending := public.get_pending_balance(_user_id);
  IF was_first_batch_ever THEN
    SELECT referred_by_code INTO referrer_code FROM public.profiles WHERE id=_user_id;
    IF referrer_code IS NOT NULL AND referrer_code <> '' THEN
      SELECT id INTO referrer_uuid FROM public.profiles WHERE referral_code=referrer_code LIMIT 1;
      IF referrer_uuid IS NOT NULL AND referrer_uuid <> _user_id THEN
        PERFORM public.grant_referral_bonus_batches(referrer_uuid, _user_id);
      END IF;
    END IF;
  END IF;
  RETURN jsonb_build_object('success',true,'batches_done',task_row.batches_done+1,
    'bonus_batches',task_row.bonus_batches,'total_batches_today',total_today,
    'naira_added',naira_per_batch_for_user,'pending_balance',new_pending,
    'was_first_batch_ever',was_first_batch_ever);
END;
$function$;

-- 3) Update pay_user_profit wording (machine payout descriptions)
CREATE OR REPLACE FUNCTION public.pay_user_profit(_user_id uuid, _spot_id uuid, _profit_amount numeric, _auto_compound boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_spot RECORD;
  v_profile RECORD;
  v_actual_profit NUMERIC;
  v_is_first_cycle BOOLEAN;
BEGIN
  SELECT is_genesis_spot, genesis_yields_remaining INTO v_spot FROM public.spots WHERE id = _spot_id;
  SELECT first_cycle_completed_at, auto_compound_enabled
  INTO v_profile FROM public.profiles WHERE id = _user_id;

  v_is_first_cycle := (v_profile.first_cycle_completed_at IS NULL);
  v_actual_profit := public.get_user_profit_amount(_user_id);

  IF v_is_first_cycle THEN
    UPDATE public.profiles SET first_cycle_completed_at = now() WHERE id = _user_id;
  END IF;

  IF v_spot.is_genesis_spot AND v_spot.genesis_yields_remaining > 0 THEN
    PERFORM public.pay_genesis_yield(_user_id, _spot_id, v_actual_profit, v_is_first_cycle);
    RETURN;
  END IF;

  INSERT INTO public.transactions (user_id, amount, transaction_type, wallet_type, description, status, metadata)
  VALUES (
    _user_id, v_actual_profit, 'drop_profit', 'earnings',
    CASE
      WHEN v_is_first_cycle THEN 'First machine payout (ready to withdraw)'
      WHEN _auto_compound THEN 'Machine payout (auto-reinvested)'
      ELSE 'Machine payout (ready to withdraw)'
    END,
    'completed',
    json_build_object('spot_id', _spot_id, 'auto_compounded', _auto_compound,
      'is_first_cycle', v_is_first_cycle, 'profit_amount', v_actual_profit)
  );

  PERFORM public.send_payout_notification(_user_id, v_actual_profit, _auto_compound);

  IF _auto_compound OR v_profile.auto_compound_enabled THEN
    PERFORM public.try_auto_buy_machine(_user_id);
  END IF;
END;
$function$;

-- 4) Backfill existing rows with clean wording
UPDATE public.transactions
SET description = REPLACE(description, 'Cycle thank-you from', 'Cycle commission from')
WHERE description LIKE 'Cycle thank-you from%';

UPDATE public.transactions
SET description = 'Daily earnings applied to machine payout'
WHERE description = 'Pending consumed for machine payout';

UPDATE public.transactions
SET description = 'Machine payout (ready to withdraw)'
WHERE description = 'Machine payout - Ready to withdraw!';

UPDATE public.transactions
SET description = 'First machine payout (ready to withdraw)'
WHERE description = 'First machine payout - Welcome to Viketa!';

UPDATE public.transactions
SET description = 'Machine payout (auto-reinvested)'
WHERE description = 'Machine payout (Empire Builder active)';

UPDATE public.transactions
SET description = 'Activation payment for your first machine'
WHERE description IN ('Activation credit for first spot', 'Activation credit (Manual approval)');

UPDATE public.transactions
SET description = 'Daily task earnings'
WHERE description LIKE 'Daily task batch reward%';

-- Replace "₦500 bonus - X completed their first cycle!" with cleaner wording
UPDATE public.transactions
SET description = REPLACE(description, ' bonus - ', ' referral bonus — ')
WHERE description LIKE '₦% bonus - %completed their first cycle!%';
