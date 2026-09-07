
-- =========================================================================
-- RETIREMENT ECONOMY V1 — Full rebuild
-- =========================================================================

-- 1. Add new column: fixed queue contribution per spot purchase
ALTER TABLE public.platform_config
  ADD COLUMN IF NOT EXISTS drop_queue_contribution numeric NOT NULL DEFAULT 2000;

-- 2. Update platform_config to new economy
UPDATE public.platform_config SET
  membership_fee                = 5000,
  drop_entry_fee                = 3000,   -- price to buy an extra spot
  drop_queue_contribution       = 2000,   -- fixed slice into queue per spot buy
  drop_target_amount            = 10000,  -- each spot needs 5×2000 = 10000 to retire
  drop_profit_amount            = 10000,
  drop_profit_amount_subsequent = 10000,
  drop_reentry_amount           = 0,      -- no more re-entry loop
  drop_referral_per_cycle       = 0,      -- no more per-cycle royalty
  drop_admin_fee                = 1000,   -- informational only (matches new margin)
  referral_cash_bonus           = 1000,   -- referrer bonus on activation
  task_naira_per_batch          = 180,    -- daily task base rate per batch per spot
  task_batches_per_day          = 10,
  task_taps_per_batch           = 10
WHERE id = 1;

-- 3. Wipe queue + user-money data (fresh start; users were nuked last turn)
TRUNCATE TABLE
  public.drops,
  public.spots,
  public.drop_pulses,
  public.drop_fill_audit_log,
  public.harvest_warnings,
  public.unlock_cycles,
  public.transactions,
  public.cached_balances,
  public.daily_task,
  public.notifications,
  public.referral_bonus_grants,
  public.payment_attempts,
  public.webhook_logs,
  public.admin_notifications,
  public.unmatched_moniepoint_payments,
  public.replay_sessions
RESTART IDENTITY CASCADE;

-- Safety: reset any surviving profiles
UPDATE public.profiles
   SET is_member              = false,
       last_payout_at         = null,
       auto_compound_enabled  = false;

-- 4. get_pending_cap(): ₦10,000 × active spots
CREATE OR REPLACE FUNCTION public.get_pending_cap(_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(cfg.drop_profit_amount, 10000) * GREATEST(
    (SELECT COUNT(*) FROM public.spots
      WHERE user_id = _user_id AND status = 'active'),
    0
  )::numeric
  FROM public.platform_config cfg WHERE cfg.id = 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_cap(uuid) TO authenticated, service_role;

-- 5. Rewrite get_daily_task to expose the cap + block flag
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
BEGIN
  IF _user_id IS NULL THEN RETURN jsonb_build_object('success',false,'error','missing user'); END IF;

  SELECT task_batches_per_day, task_taps_per_batch, task_naira_per_batch,
         task_referral_bonus_batches, task_loader_seconds, task_enabled,
         referral_cash_bonus, drop_profit_amount, drop_entry_fee
    INTO cfg FROM public.platform_config WHERE id = 1;

  today_utc := (now() AT TIME ZONE 'UTC')::date;

  SELECT COUNT(*) INTO spot_count FROM public.spots
   WHERE user_id = _user_id AND status = 'active';

  -- Users with 0 spots see the base rate for preview; cap is 0 (blocked immediately if they somehow enter).
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

  RETURN jsonb_build_object(
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
END;
$function$;

-- 6. Rewrite complete_batch to enforce the cap (also keeps per-spot base rate)
CREATE OR REPLACE FUNCTION public.complete_batch(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  just_completed_full_set boolean := false;
  has_prior_full_set boolean := false;
  referrer_uuid uuid;
  referrer_code text;
  new_pending numeric;
  pending numeric;
  cap numeric;
BEGIN
  IF _user_id IS NULL THEN RETURN jsonb_build_object('success',false,'error','missing user'); END IF;
  SELECT task_batches_per_day, task_taps_per_batch, task_naira_per_batch,
         task_enabled, drop_profit_amount, drop_entry_fee
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

  naira_per_batch_for_user := cfg.task_naira_per_batch * spot_count;
  base_batches_per_day := cfg.task_batches_per_day;

  -- CAP CHECK (block before charging batch)
  pending := public.get_pending_balance(_user_id);
  cap := cfg.drop_profit_amount * spot_count;
  IF cap > 0 AND pending + naira_per_batch_for_user > cap THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'capacity_full',
      'pending', pending,
      'cap', cap,
      'extension_spot_price', cfg.drop_entry_fee,
      'payout_per_spot', cfg.drop_profit_amount
    );
  END IF;

  INSERT INTO public.daily_task (user_id, task_date, batches_done, bonus_batches)
    VALUES (_user_id, today_utc, 0, 0)
    ON CONFLICT (user_id, task_date) DO NOTHING;
  SELECT * INTO task_row FROM public.daily_task
    WHERE user_id=_user_id AND task_date=today_utc FOR UPDATE;
  total_today := base_batches_per_day + task_row.bonus_batches;
  IF task_row.batches_done >= total_today THEN
    RETURN jsonb_build_object(
      'success',false,'error','limit_reached',
      'batches_done',task_row.batches_done,'total_batches_today',total_today
    );
  END IF;

  new_batches_done := task_row.batches_done + 1;
  UPDATE public.daily_task SET batches_done = new_batches_done
    WHERE user_id=_user_id AND task_date=today_utc;

  INSERT INTO public.transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES (_user_id,'pending'::wallet_type, naira_per_batch_for_user,
          'task_earning'::transaction_type,
          'Daily task earnings','completed'::transaction_status,
          jsonb_build_object('task_date',today_utc,'batch_number',new_batches_done,
            'spot_count',spot_count,'naira_per_batch',naira_per_batch_for_user));
  new_pending := public.get_pending_balance(_user_id);

  IF new_batches_done >= base_batches_per_day THEN
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
    'naira_added',naira_per_batch_for_user,
    'pending_balance',new_pending,
    'pending_cap', cap,
    'completed_full_set_today', just_completed_full_set
  );
END;
$function$;

-- 7. get_distribution_data: skip retired spots + expose queue_contribution
CREATE OR REPLACE FUNCTION public.get_distribution_data(_origin_drop_id uuid, _max_drops integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_config JSONB;
  v_drops  JSONB;
  v_max_position INTEGER;
BEGIN
  SELECT jsonb_build_object(
    'drop_entry_fee', drop_entry_fee,
    'drop_queue_contribution', drop_queue_contribution,
    'drop_target_amount', drop_target_amount,
    'drop_profit_amount', drop_profit_amount,
    'drop_profit_amount_subsequent', drop_profit_amount_subsequent,
    'drop_admin_fee', drop_admin_fee,
    'drop_referral_per_cycle', drop_referral_per_cycle,
    'drop_reentry_amount', drop_reentry_amount,
    'drop_system_active', drop_system_active,
    'distribution_active', distribution_active
  ) INTO v_config
  FROM platform_config WHERE id = 1;

  SELECT COALESCE(jsonb_agg(row_to_json(d)::jsonb), '[]')
  INTO v_drops
  FROM (
    SELECT
      d.id as drop_id,
      d.fill_amount,
      d.target_amount,
      d.position,
      d.status,
      d.source_type,
      s.id as spot_id,
      s.user_id as owner_id,
      s.spot_name,
      p.full_name as owner_name,
      p.auto_compound_enabled,
      p.referred_by_code,
      p.referral_code,
      p.last_payout_at,
      (SELECT id FROM profiles WHERE referral_code = p.referred_by_code LIMIT 1) as referrer_id,
      (SELECT COALESCE(SUM(amount),0) FROM transactions
        WHERE user_id = s.user_id AND wallet_type='deposit' AND status='completed') as deposit_balance,
      (SELECT COALESCE(SUM(amount),0) FROM transactions
        WHERE user_id = s.user_id AND wallet_type='earnings' AND status='completed') as earnings_balance,
      COALESCE(public.get_pending_balance(s.user_id),0) as pending_balance,
      (SELECT COUNT(*) FROM spots WHERE user_id = s.user_id AND status='active') as user_spot_count,
      (SELECT COUNT(*)::int FROM profiles rp
        WHERE rp.referred_by_code = p.referral_code AND rp.is_member = true) as active_referrals_count
    FROM drops d
    JOIN spots s ON s.id = d.spot_id
    JOIN profiles p ON p.id = s.user_id
    WHERE d.id != _origin_drop_id
      AND d.status IN ('waiting','filling')
      AND d.fill_amount < d.target_amount
      AND s.status = 'active'          -- skip retired spots
    ORDER BY d.position ASC
    LIMIT _max_drops
  ) d;

  SELECT COALESCE(MAX(position),0) INTO v_max_position FROM drops;

  RETURN jsonb_build_object(
    'config', v_config,
    'drops', v_drops,
    'current_max_position', v_max_position
  );
END;
$function$;
