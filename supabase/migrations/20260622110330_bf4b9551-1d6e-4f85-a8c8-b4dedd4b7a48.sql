CREATE OR REPLACE FUNCTION public.try_consume_unlock(_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
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
  v_fresh_ids uuid[];
  v_to_consume_ids uuid[];
  v_next_cycle integer;
  v_new_cycle_id uuid;
  v_has_successful_withdrawal boolean;
BEGIN
  v_user_id := COALESCE(_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF v_user_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = v_user_id FOR UPDATE;

  SELECT referral_code, COALESCE(is_member, false)
    INTO v_referral_code, v_is_member
  FROM public.profiles WHERE id = v_user_id;

  IF NOT v_is_member THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not an active member');
  END IF;

  SELECT
    COALESCE(unlock_pending_threshold, 27000),
    COALESCE(unlock_invites_required, 3),
    COALESCE(unlock_system_active, true)
    INTO v_threshold, v_invites_required, v_system_active
  FROM public.platform_config WHERE id = 1;

  IF NOT v_system_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unlock system disabled');
  END IF;

  -- Gate only applies AFTER first successful withdrawal. Users who have
  -- never withdrawn bypass the system and should not create cycles.
  SELECT EXISTS (
    SELECT 1 FROM public.transactions
    WHERE user_id = v_user_id
      AND transaction_type = 'withdrawal'
      AND status = 'completed'
  ) INTO v_has_successful_withdrawal;

  IF NOT v_has_successful_withdrawal THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Gate does not apply yet',
      'reason', 'no_successful_withdrawal'
    );
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_pending_balance
  FROM public.transactions
  WHERE user_id = v_user_id AND wallet_type = 'pending';
  v_pending_balance := GREATEST(v_pending_balance, 0);

  IF v_pending_balance < v_threshold THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pending balance below threshold',
      'pending_balance', v_pending_balance,
      'pending_threshold', v_threshold
    );
  END IF;

  SELECT COALESCE(array_agg(DISTINCT id), '{}')
    INTO v_consumed_ids
  FROM (
    SELECT unnest(consumed_referee_ids) AS id
    FROM public.unlock_cycles
    WHERE user_id = v_user_id
  ) x;

  SELECT COALESCE(array_agg(p.id ORDER BY p.activated_at ASC), '{}')
    INTO v_fresh_ids
  FROM public.profiles p
  WHERE v_referral_code IS NOT NULL
    AND LOWER(p.referred_by_code) = LOWER(v_referral_code)
    AND COALESCE(p.is_member, false) = true
    AND p.activated_at IS NOT NULL
    AND NOT (p.id = ANY(v_consumed_ids));

  IF COALESCE(array_length(v_fresh_ids, 1), 0) < v_invites_required THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not enough fresh invites',
      'fresh_invites_count', COALESCE(array_length(v_fresh_ids, 1), 0),
      'invites_required', v_invites_required
    );
  END IF;

  v_to_consume_ids := v_fresh_ids[1:v_invites_required];

  SELECT COALESCE(SUM(amount), 0) INTO v_earnings_balance
  FROM public.transactions
  WHERE user_id = v_user_id AND wallet_type = 'earnings';
  v_earnings_balance := GREATEST(v_earnings_balance, 0);

  SELECT COALESCE(MAX(cycle_number), 0) + 1 INTO v_next_cycle
  FROM public.unlock_cycles WHERE user_id = v_user_id;

  INSERT INTO public.unlock_cycles (
    user_id, cycle_number, consumed_referee_ids,
    pending_balance_at_unlock, silent_earnings_revealed
  ) VALUES (
    v_user_id, v_next_cycle, v_to_consume_ids,
    v_pending_balance, v_earnings_balance
  )
  RETURNING id INTO v_new_cycle_id;

  PERFORM public.create_notification(
    _user_id := v_user_id,
    _type := 'unlock_claimed',
    _title := CASE WHEN v_next_cycle = 1
      THEN 'System Synchronized!'
      ELSE format('Unlock #%s claimed!', v_next_cycle)
    END,
    _message := format(
      '₦%s pending balance authorized for migration. ₦%s now available in your wallet.',
      to_char(v_pending_balance, 'FM999,999,990'),
      to_char(v_earnings_balance, 'FM999,999,990')
    ),
    _link := '/dashboard'
  );

  RETURN jsonb_build_object(
    'success', true,
    'cycle_id', v_new_cycle_id,
    'cycle_number', v_next_cycle,
    'consumed_referee_ids', v_to_consume_ids,
    'pending_balance_at_unlock', v_pending_balance,
    'silent_earnings_revealed', v_earnings_balance
  );
END;
$function$;