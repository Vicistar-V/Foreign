-- 1. Trigger that depended on the legacy calibration RPC
DROP TRIGGER IF EXISTS trg_grant_referrer_calibration_on_activation ON public.profiles;

-- 2. Legacy RPCs
DROP FUNCTION IF EXISTS public.get_or_create_daily_calibration(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.record_calibration_clicks(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.release_pending_calibration_yield(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.add_pending_yield(uuid, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.simulate_yield_for_free_user(uuid, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.add_calibration_batches_for_referral(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.grant_referrer_calibration_on_activation() CASCADE;
DROP FUNCTION IF EXISTS public.pay_genesis_yield(uuid, uuid, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.touch_calibration_log_updated_at() CASCADE;

-- 3. Legacy table
DROP TABLE IF EXISTS public.daily_calibration_log CASCADE;

-- 4. Legacy profile columns
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS simulated_yield,
  DROP COLUMN IF EXISTS total_burned_yield,
  DROP COLUMN IF EXISTS calibration_streak,
  DROP COLUMN IF EXISTS longest_calibration_streak,
  DROP COLUMN IF EXISTS last_calibration_date,
  DROP COLUMN IF EXISTS calibration_activated_at;

-- 5. Legacy platform_config columns
ALTER TABLE public.platform_config
  DROP COLUMN IF EXISTS calibration_enabled,
  DROP COLUMN IF EXISTS calibration_clicks_per_batch,
  DROP COLUMN IF EXISTS calibration_base_batches,
  DROP COLUMN IF EXISTS calibration_threshold_batches,
  DROP COLUMN IF EXISTS calibration_threshold_per_spot,
  DROP COLUMN IF EXISTS calibration_threshold_per_spot_cap,
  DROP COLUMN IF EXISTS calibration_bonus_per_referral,
  DROP COLUMN IF EXISTS calibration_min_click_interval_ms,
  DROP COLUMN IF EXISTS calibration_simulation_enabled,
  DROP COLUMN IF EXISTS calibration_simulation_cap,
  DROP COLUMN IF EXISTS calibration_simulated_yield_per_batch,
  DROP COLUMN IF EXISTS calibration_burn_enabled;

-- 6. Rebuild get_distribution_data WITHOUT calibration_threshold_reached_today / total_recycled_profit / calibration_* config
CREATE OR REPLACE FUNCTION public.get_distribution_data(
  _origin_drop_id uuid,
  _max_drops integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_config JSONB;
  v_drops JSONB;
  v_max_position INTEGER;
BEGIN
  SELECT jsonb_build_object(
    'drop_entry_fee', drop_entry_fee,
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
      s.is_genesis_spot,
      s.genesis_yields_remaining,
      p.full_name as owner_name,
      p.auto_compound_enabled,
      p.referred_by_code,
      p.referral_code,
      p.first_cycle_completed_at,
      p.last_payout_at,
      (
        SELECT id FROM profiles
        WHERE referral_code = p.referred_by_code LIMIT 1
      ) as referrer_id,
      (
        SELECT COALESCE(SUM(amount), 0) FROM transactions
        WHERE user_id = s.user_id AND wallet_type = 'deposit' AND status = 'completed'
      ) as deposit_balance,
      (
        SELECT COALESCE(SUM(amount), 0) FROM transactions
        WHERE user_id = s.user_id AND wallet_type = 'earnings' AND status = 'completed'
      ) as earnings_balance,
      (SELECT COUNT(*) FROM spots WHERE user_id = s.user_id) as user_spot_count
    FROM drops d
    JOIN spots s ON s.id = d.spot_id
    JOIN profiles p ON p.id = s.user_id
    WHERE d.id != _origin_drop_id
      AND d.status IN ('waiting', 'filling')
      AND d.fill_amount < d.target_amount
    ORDER BY d.position ASC
    LIMIT _max_drops
  ) d;

  SELECT COALESCE(MAX(position), 0) INTO v_max_position FROM drops;

  RETURN jsonb_build_object(
    'config', v_config,
    'drops', v_drops,
    'current_max_position', v_max_position
  );
END;
$function$;

-- 7. Ensure UNIQUE(user_id) on cached_balances (only if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.cached_balances'::regclass
      AND contype = 'u'
      AND conkey = (
        SELECT array_agg(attnum)::int2[] FROM pg_attribute
        WHERE attrelid = 'public.cached_balances'::regclass AND attname = 'user_id'
      )
  ) THEN
    BEGIN
      ALTER TABLE public.cached_balances
        ADD CONSTRAINT cached_balances_user_id_key UNIQUE (user_id);
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
END$$;

-- 8. New admin RPC: grant bonus batches for today (Africa/Lagos)
CREATE OR REPLACE FUNCTION public.admin_grant_bonus_batches(
  _user_id uuid,
  _bonus integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Africa/Lagos')::date;
  v_new_bonus integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'admin role required');
  END IF;

  IF _bonus IS NULL OR _bonus <= 0 OR _bonus > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'bonus must be 1..100');
  END IF;

  INSERT INTO public.daily_task (user_id, task_date, batches_done, bonus_batches)
  VALUES (_user_id, v_today, 0, _bonus)
  ON CONFLICT (user_id, task_date)
  DO UPDATE SET
    bonus_batches = public.daily_task.bonus_batches + EXCLUDED.bonus_batches,
    updated_at = now()
  RETURNING bonus_batches INTO v_new_bonus;

  INSERT INTO public.notifications (user_id, notification_type, title, message, link)
  VALUES (
    _user_id,
    'task_bonus_granted',
    'You got bonus batches!',
    'An admin gave you +' || _bonus || ' bonus batches for today. Open Daily Task to use them.',
    '/task'
  );

  RETURN jsonb_build_object(
    'success', true,
    'granted', _bonus,
    'bonus_batches_today', v_new_bonus
  );
END;
$function$;