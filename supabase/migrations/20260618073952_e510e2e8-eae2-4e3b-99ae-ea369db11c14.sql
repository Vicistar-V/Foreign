
-- =====================================================
-- get_my_profile: profile + has_pin for the logged-in user
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile jsonb;
  v_pin_hash text;
  v_has_pin boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT jsonb_build_object(
    'id', id,
    'full_name', full_name,
    'avatar_url', avatar_url,
    'is_member', is_member,
    'is_banned', is_banned,
    'banned_reason', banned_reason,
    'is_name_locked', is_name_locked,
    'referral_code', referral_code,
    'phone_number', phone_number,
    'auto_compound_enabled', auto_compound_enabled,
    'last_payout_at', last_payout_at,
    'last_seen_at', last_seen_at,
    'created_at', created_at,
    'has_seen_explainer', has_seen_explainer,
    'birth_year', birth_year,
    'birth_month', birth_month
  ) INTO v_profile
  FROM public.profiles
  WHERE id = v_uid;

  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT pin_hash INTO v_pin_hash
  FROM public.user_pin_secrets
  WHERE user_id = v_uid;

  v_has_pin := v_pin_hash IS NOT NULL AND left(v_pin_hash, 2) = '$2';

  RETURN v_profile || jsonb_build_object('has_pin', v_has_pin);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated, service_role;

-- =====================================================
-- get_my_balances: full balance bundle for the logged-in user
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_my_balances()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_earnings numeric;
  v_deposit numeric;
  v_pending numeric;
  v_last_updated timestamptz;
  v_active_spots integer;
  v_entry_fee numeric;
  v_from_referrals numeric;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not authenticated',
      'errorCode', 'UNAUTHORIZED'
    );
  END IF;

  -- Try cached balances first
  SELECT earnings_balance, deposit_balance, pending_balance, last_updated
    INTO v_earnings, v_deposit, v_pending, v_last_updated
  FROM public.cached_balances
  WHERE user_id = v_uid;

  -- Fallback: compute from the ledger and warm the cache
  IF v_earnings IS NULL THEN
    SELECT
      COALESCE(SUM(CASE WHEN wallet_type = 'earnings' THEN amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN wallet_type = 'deposit'  THEN amount ELSE 0 END), 0),
      GREATEST(COALESCE(SUM(CASE WHEN wallet_type = 'pending' THEN amount ELSE 0 END), 0), 0)
      INTO v_earnings, v_deposit, v_pending
    FROM public.transactions
    WHERE user_id = v_uid;

    v_last_updated := now();

    INSERT INTO public.cached_balances (user_id, earnings_balance, deposit_balance, pending_balance, last_updated)
    VALUES (v_uid, v_earnings, v_deposit, v_pending, v_last_updated)
    ON CONFLICT (user_id)
    DO UPDATE SET
      earnings_balance = EXCLUDED.earnings_balance,
      deposit_balance  = EXCLUDED.deposit_balance,
      pending_balance  = EXCLUDED.pending_balance,
      last_updated     = EXCLUDED.last_updated;
  END IF;

  -- Referral earnings breakdown (only real referral bonuses)
  SELECT COALESCE(SUM(amount), 0) INTO v_from_referrals
  FROM public.transactions
  WHERE user_id = v_uid
    AND wallet_type = 'earnings'
    AND transaction_type = 'membership_bonus'
    AND status = 'completed'
    AND metadata ? 'referral_code'
    AND metadata->>'referral_code' IS NOT NULL;

  -- Active spots + total staked
  SELECT COUNT(*) INTO v_active_spots
  FROM public.spots
  WHERE user_id = v_uid AND status = 'active';

  SELECT COALESCE(drop_entry_fee, 1000) INTO v_entry_fee
  FROM public.platform_config WHERE id = 1;

  RETURN jsonb_build_object(
    'success', true,
    'earnings_balance', v_earnings,
    'deposit_balance', v_deposit,
    'pending_balance', GREATEST(v_pending, 0),
    'last_updated', v_last_updated,
    'breakdown', jsonb_build_object('from_referrals', v_from_referrals),
    'active_spots_count', v_active_spots,
    'total_staked', v_active_spots * v_entry_fee
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_balances() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_balances() TO authenticated, service_role;

-- =====================================================
-- get_my_withdrawal_accounts: payout accounts for the logged-in user
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_my_withdrawal_accounts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_accounts jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(wa) ORDER BY wa.is_primary DESC, wa.created_at DESC), '[]'::jsonb)
    INTO v_accounts
  FROM public.withdrawal_accounts wa
  WHERE wa.user_id = v_uid;

  RETURN jsonb_build_object('accounts', v_accounts);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_withdrawal_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_withdrawal_accounts() TO authenticated, service_role;

-- =====================================================
-- get_public_stats: anonymous-safe Viketa Line stats
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_profit numeric;
  v_total_cycles bigint;
  v_total_spots bigint;
  v_system_active boolean;
  v_queue jsonb;
  v_recent jsonb;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_total_profit
  FROM public.transactions
  WHERE transaction_type = 'drop_profit' AND status = 'completed';

  SELECT COALESCE(SUM(total_cycles), 0) INTO v_total_cycles FROM public.spots;
  SELECT COUNT(*) INTO v_total_spots FROM public.spots;

  SELECT COALESCE(drop_system_active, true) INTO v_system_active
  FROM public.platform_config WHERE id = 1;

  SELECT to_jsonb(public.get_drop_queue_status()) INTO v_queue;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'pulseNumber', pulse_number,
    'payouts', COALESCE(payouts_made, 0),
    'distributed', COALESCE(total_distributed, 0)::numeric,
    'timestamp', started_at
  ) ORDER BY pulse_number DESC), '[]'::jsonb) INTO v_recent
  FROM (
    SELECT pulse_number, payouts_made, total_distributed, started_at
    FROM public.drop_pulses
    ORDER BY pulse_number DESC
    LIMIT 10
  ) recent;

  RETURN jsonb_build_object(
    'totalProfitDistributed', v_total_profit,
    'totalCycles', v_total_cycles,
    'totalSpots', v_total_spots,
    'dropsInQueue', COALESCE((v_queue->>'total_in_queue')::int, 0),
    'nextPayoutPosition', COALESCE((v_queue->>'next_position')::int, 0),
    'isDropSystemActive', v_system_active,
    'recentPayouts', v_recent
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon, authenticated, service_role;

-- =====================================================
-- get_my_drop_status: full dashboard drop bundle
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_my_drop_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- User's spots (reuse existing RPC)
  SELECT to_jsonb(public.get_user_drops_status(v_uid, 6, 0)) INTO v_user_drops;

  -- Global queue (reuse existing RPC)
  SELECT to_jsonb(public.get_drop_queue_status()) INTO v_queue;

  SELECT COUNT(*) INTO v_total_queue_count
  FROM public.drops WHERE status IN ('waiting', 'filling');

  -- Platform config
  SELECT
    drop_entry_fee,
    drop_target_amount,
    drop_profit_amount,
    drop_profit_amount_subsequent,
    drop_system_active,
    drop_pulse_interval_seconds
    INTO v_config
  FROM public.platform_config WHERE id = 1;

  v_standard_profit := COALESCE(v_config.drop_profit_amount_subsequent, v_config.drop_profit_amount, 900);

  -- Currently filling drops (top 20)
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
  JOIN public.profiles p ON p.id = s.user_id;

  -- Recent payouts (last 30)
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

  -- Recent referral bonuses (last 30 that name a referee)
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
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_drop_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_drop_status() TO authenticated, service_role;
