CREATE OR REPLACE FUNCTION public.get_unlock_status(_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_referral_code text;
  v_is_member boolean;
  v_threshold numeric;
  v_invites_required integer;
  v_system_active boolean;
  v_pending_balance numeric;
  v_earnings_balance numeric;
  v_consumed_ids uuid[];
  v_fresh_invites_count integer;
  v_total_cycles integer;
  v_latest_cycle_number integer;
  v_latest_unlocked_at timestamptz;
  v_is_unlocked boolean;
  v_has_successful_withdrawal boolean;
BEGIN
  v_user_id := COALESCE(_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF v_user_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  SELECT referral_code, COALESCE(is_member, false)
    INTO v_referral_code, v_is_member
  FROM public.profiles WHERE id = v_user_id;

  SELECT
    COALESCE(unlock_pending_threshold, 27000),
    COALESCE(unlock_invites_required, 3),
    COALESCE(unlock_system_active, true)
    INTO v_threshold, v_invites_required, v_system_active
  FROM public.platform_config WHERE id = 1;

  SELECT COALESCE(SUM(amount), 0) INTO v_pending_balance
  FROM public.transactions
  WHERE user_id = v_user_id AND wallet_type = 'pending';
  v_pending_balance := GREATEST(v_pending_balance, 0);

  SELECT COALESCE(SUM(amount), 0) INTO v_earnings_balance
  FROM public.transactions
  WHERE user_id = v_user_id AND wallet_type = 'earnings';
  v_earnings_balance := GREATEST(v_earnings_balance, 0);

  SELECT COALESCE(array_agg(DISTINCT id), '{}')
    INTO v_consumed_ids
  FROM (
    SELECT unnest(consumed_referee_ids) AS id
    FROM public.unlock_cycles
    WHERE user_id = v_user_id
  ) x;

  SELECT COUNT(*) INTO v_fresh_invites_count
  FROM public.profiles p
  WHERE v_referral_code IS NOT NULL
    AND LOWER(p.referred_by_code) = LOWER(v_referral_code)
    AND COALESCE(p.is_member, false) = true
    AND p.activated_at IS NOT NULL
    AND NOT (p.id = ANY(v_consumed_ids));

  SELECT COUNT(*), MAX(cycle_number), MAX(unlocked_at)
    INTO v_total_cycles, v_latest_cycle_number, v_latest_unlocked_at
  FROM public.unlock_cycles WHERE user_id = v_user_id;

  -- Grandfather check: any user who has already completed at least one withdrawal
  -- is treated as fully unlocked. They've proven they can cash out — the new gate
  -- doesn't apply to them.
  SELECT EXISTS (
    SELECT 1 FROM public.transactions
    WHERE user_id = v_user_id
      AND transaction_type = 'withdrawal'
      AND status = 'completed'
  ) INTO v_has_successful_withdrawal;

  v_is_unlocked := COALESCE(v_total_cycles, 0) > 0;

  IF v_system_active IS NOT TRUE THEN
    v_is_unlocked := true;
  END IF;

  -- Grandfather: prior successful withdrawal => always unlocked
  IF v_has_successful_withdrawal THEN
    v_is_unlocked := true;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'is_member', v_is_member,
    'system_active', v_system_active,
    'is_unlocked', v_is_unlocked,
    'has_successful_withdrawal', v_has_successful_withdrawal,
    'pending_threshold', v_threshold,
    'invites_required', v_invites_required,
    'pending_balance', v_pending_balance,
    'earnings_balance', v_earnings_balance,
    'fresh_invites_count', v_fresh_invites_count,
    'consumed_invites_count', COALESCE(array_length(v_consumed_ids, 1), 0),
    'total_unlock_cycles', COALESCE(v_total_cycles, 0),
    'current_cycle_number', COALESCE(v_latest_cycle_number, 0),
    'latest_unlocked_at', v_latest_unlocked_at,
    'ready_to_unlock',
      v_is_member
      AND v_system_active
      AND NOT v_has_successful_withdrawal
      AND v_pending_balance >= v_threshold
      AND v_fresh_invites_count >= v_invites_required,
    'withdraw_gated',
      v_is_unlocked
      AND v_system_active
      AND NOT v_has_successful_withdrawal
      AND v_pending_balance >= v_threshold
      AND v_fresh_invites_count < v_invites_required
  );
END;
$function$;