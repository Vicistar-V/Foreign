
-- 1. harvest_warnings table for pre-turn warning deduplication
CREATE TABLE IF NOT EXISTS public.harvest_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  spot_id uuid NOT NULL,
  warn_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS harvest_warnings_spot_date_uniq
  ON public.harvest_warnings (spot_id, warn_date);

CREATE INDEX IF NOT EXISTS harvest_warnings_user_idx
  ON public.harvest_warnings (user_id, warn_date DESC);

ALTER TABLE public.harvest_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own harvest warnings"
  ON public.harvest_warnings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages harvest warnings"
  ON public.harvest_warnings
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 2. Update get_distribution_data to include pending_balance per drop
CREATE OR REPLACE FUNCTION public.get_distribution_data(_origin_drop_id uuid, _max_drops integer DEFAULT 50)
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
      p.full_name as owner_name,
      p.auto_compound_enabled,
      p.referred_by_code,
      p.referral_code,
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
      COALESCE(public.get_pending_balance(s.user_id), 0) as pending_balance,
      (SELECT COUNT(*) FROM spots WHERE user_id = s.user_id) as user_spot_count,
      (SELECT COUNT(*)::int FROM profiles rp WHERE rp.referred_by_code = p.referral_code AND rp.is_member = true) as active_referrals_count
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
