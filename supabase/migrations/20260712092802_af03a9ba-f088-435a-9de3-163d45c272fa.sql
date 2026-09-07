CREATE OR REPLACE FUNCTION public.get_daily_task(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  cfg RECORD;
  today_utc date;
  task_row RECORD;
  spot_count int;
  naira_per_batch_for_user numeric;
  pending numeric;
  cap numeric;
  total_today int;
  batches_done_val int;
  bonus_batches_val int;
  capacity_full boolean;
  result jsonb;
BEGIN
  IF _user_id IS NULL THEN RETURN jsonb_build_object('success',false,'error','missing user'); END IF;

  SELECT task_batches_per_day, task_taps_per_batch, task_naira_per_batch,
         task_referral_bonus_batches, task_loader_seconds, task_enabled,
         referral_cash_bonus, drop_profit_amount, drop_entry_fee
    INTO cfg FROM public.platform_config WHERE id = 1;

  today_utc := (now() AT TIME ZONE 'UTC')::date;

  SELECT COUNT(*) INTO spot_count FROM public.spots
   WHERE user_id = _user_id AND status = 'active';

  naira_per_batch_for_user := cfg.task_naira_per_batch * GREATEST(spot_count, 1);

  SELECT batches_done, bonus_batches INTO task_row FROM public.daily_task
    WHERE user_id = _user_id AND task_date = today_utc;
  IF task_row IS NULL THEN
    batches_done_val := 0; bonus_batches_val := 0;
  ELSE
    batches_done_val := task_row.batches_done;
    bonus_batches_val := task_row.bonus_batches;
  END IF;

  total_today := cfg.task_batches_per_day + bonus_batches_val;
  pending := public.get_pending_balance(_user_id);
  cap := cfg.drop_profit_amount * GREATEST(spot_count, 0);
  capacity_full := (cap > 0 AND pending + naira_per_batch_for_user > cap);

  result := jsonb_build_object(
    'success', true,
    'today', today_utc,
    'task_enabled', cfg.task_enabled,
    'batches_done', batches_done_val,
    'bonus_batches', bonus_batches_val,
    'batches_per_day', cfg.task_batches_per_day,
    'taps_per_batch', cfg.task_taps_per_batch,
    'naira_per_batch_for_user', naira_per_batch_for_user,
    'naira_per_batch_base', cfg.task_naira_per_batch,
    'machine_count', spot_count,
    'spot_count', spot_count,
    'total_batches_today', total_today,
    'can_do_more', cfg.task_enabled
                    AND batches_done_val < total_today
                    AND (cap = 0 OR NOT capacity_full),
    'loader_seconds', cfg.task_loader_seconds,
    'referral_bonus_batches', cfg.task_referral_bonus_batches,
    'referral_cash_bonus', cfg.referral_cash_bonus,
    'pending_balance', pending,
    'pending_cap', cap,
    'capacity_full', capacity_full,
    'extension_spot_price', cfg.drop_entry_fee,
    'payout_per_spot', cfg.drop_profit_amount
  );

  IF capacity_full THEN
    result := result || jsonb_build_object(
      'message', 'Your basket is full. Buy another spot to keep earning.'
    );
  END IF;

  RETURN result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_daily_task(uuid) TO authenticated, service_role;