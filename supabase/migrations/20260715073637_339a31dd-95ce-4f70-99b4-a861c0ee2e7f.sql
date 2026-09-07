CREATE OR REPLACE FUNCTION public.get_distribution_data(_origin_drop_id uuid, _max_drops integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

  -- FAIRNESS FIX: front-of-line always wins regardless of who paid.
  -- Previously we excluded the origin drop (d.id != _origin_drop_id) which
  -- meant if the payer happened to be at position 1, position 1 was skipped
  -- and position 2 got their contribution. That is an arbitrary bias, not a
  -- safeguard: the payer's own target rose in the same transaction (extension)
  -- or is brand-new at end of queue (new spot), so filling their own drop
  -- does not let them self-harvest — they still need others to fund the rest.
  -- _origin_drop_id is still passed in and used for audit tagging.
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
    WHERE d.status IN ('waiting','filling')
      AND d.fill_amount < d.target_amount
      AND s.status = 'active'
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