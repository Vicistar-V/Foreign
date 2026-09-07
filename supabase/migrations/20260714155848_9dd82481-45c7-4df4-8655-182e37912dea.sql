CREATE OR REPLACE FUNCTION public.get_my_drop_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_user_drops jsonb;
  v_queue jsonb;
  v_total_queue_count bigint;
  v_config record;
  v_standard_profit numeric;
  v_currently_filling jsonb;
  v_recent_payouts jsonb;
  v_recent_referral_bonuses jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT to_jsonb(public.get_user_drops_status(v_uid, 6, 0)) INTO v_user_drops;
  SELECT to_jsonb(public.get_drop_queue_status()) INTO v_queue;

  SELECT COUNT(*) INTO v_total_queue_count
  FROM public.drops WHERE status IN ('waiting', 'filling');

  SELECT
    drop_entry_fee,
    drop_queue_contribution,
    drop_target_amount,
    drop_profit_amount,
    drop_profit_amount_subsequent,
    drop_system_active,
    drop_pulse_interval_seconds
    INTO v_config
  FROM public.platform_config WHERE id = 1;

  v_standard_profit := COALESCE(v_config.drop_profit_amount_subsequent, v_config.drop_profit_amount, 900);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'position', d.position,
    'fill_amount', d.fill_amount,
    'target_amount', d.target_amount,
    'fill_percent', CASE WHEN d.target_amount > 0
      THEN ROUND((d.fill_amount / d.target_amount) * 100)::int ELSE 0 END,
    'status', d.status,
    'user_id', p.id,
    'user_name', COALESCE(p.full_name, 'Unknown'),
    'avatar_url', p.avatar_url,
    'spot_name', COALESCE(s.spot_name, 'Spot'),
    'spots_count', COALESCE(sc.cnt, 1),
    'has_referrer', p.referred_by_code IS NOT NULL
  ) ORDER BY d.position ASC), '[]'::jsonb) INTO v_currently_filling
  FROM (
    SELECT id, position, fill_amount, target_amount, status, spot_id
    FROM public.drops
    WHERE status IN ('waiting', 'filling')
    ORDER BY position ASC
    LIMIT 20
  ) d
  JOIN public.spots s ON s.id = d.spot_id
  JOIN public.profiles p ON p.id = s.user_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS cnt
    FROM public.spots s2
    WHERE s2.user_id = p.id AND s2.status = 'active'
  ) sc ON TRUE;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'type', 'payout',
    'position', d.position,
    'paid_at', d.paid_at,
    'created_at', d.paid_at,
    'user_id', p.id,
    'user_name', split_part(COALESCE(p.full_name, 'User'), ' ', 1),
    'avatar_url', p.avatar_url,
    'referred_by_code', p.referred_by_code,
    'profit', v_standard_profit
  ) ORDER BY d.paid_at DESC), '[]'::jsonb) INTO v_recent_payouts
  FROM (
    SELECT id, position, paid_at, spot_id
    FROM public.drops
    WHERE status IN ('paid', 're-entered')
    ORDER BY paid_at DESC NULLS LAST
    LIMIT 30
  ) d
  JOIN public.spots s ON s.id = d.spot_id
  JOIN public.profiles p ON p.id = s.user_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'type', 'referral',
    'id', t.id,
    'created_at', t.created_at,
    'earner_name', split_part(COALESCE(p.full_name, 'User'), ' ', 1),
    'earner_avatar', p.avatar_url,
    'referee_name', split_part(COALESCE(t.metadata->>'referee_name', 'Someone'), ' ', 1),
    'amount', t.amount,
    'bonus_type', CASE WHEN t.transaction_type = 'referral_first_cycle_bonus'
      THEN 'activation' ELSE 'cycle' END
  ) ORDER BY t.created_at DESC), '[]'::jsonb) INTO v_recent_referral_bonuses
  FROM (
    SELECT id, user_id, amount, transaction_type, created_at, metadata
    FROM public.transactions
    WHERE transaction_type IN ('referral_first_cycle_bonus', 'drop_referral_cycle')
      AND status = 'completed'
      AND (metadata ? 'referee_name' OR metadata ? 'referral_code')
    ORDER BY created_at DESC
    LIMIT 30
  ) t
  JOIN public.profiles p ON p.id = t.user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user', v_user_drops,
    'queue', (v_queue || jsonb_build_object('total_queue_count', v_total_queue_count)),
    'config', jsonb_build_object(
      'entry_fee', COALESCE(v_config.drop_entry_fee, 1000),
      'queue_contribution', COALESCE(v_config.drop_queue_contribution, 2000),
      'target_amount', COALESCE(v_config.drop_target_amount, 2000),
      'profit_amount', v_standard_profit,
      'profit_amount_first_cycle', v_standard_profit,
      'profit_amount_subsequent', v_standard_profit,
      'system_active', COALESCE(v_config.drop_system_active, true),
      'pulse_interval', COALESCE(v_config.drop_pulse_interval_seconds, 60)
    ),
    'currently_filling', v_currently_filling,
    'recent_payouts', v_recent_payouts,
    'recent_referral_bonuses', v_recent_referral_bonuses
  );
END;
$function$;