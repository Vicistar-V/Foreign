
-- F1 (P0): re-create atomic_admin_adjust_balance with pending cap-clamp.
DROP FUNCTION IF EXISTS public.atomic_admin_adjust_balance(uuid, numeric, wallet_type, text, text, uuid);

CREATE FUNCTION public.atomic_admin_adjust_balance(
  _user_id uuid,
  _amount numeric,
  _wallet_type wallet_type,
  _operation text,
  _reason text,
  _admin_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_signed_amount numeric;
  v_tx_type transaction_type;
  v_description text;
  v_current_balance numeric;
  v_user_name text;
  v_spot_count int;
  v_cap_per_spot numeric;
  v_cap numeric;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  IF _operation NOT IN ('add','remove') THEN
    RAISE EXCEPTION 'Operation must be add or remove';
  END IF;

  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = _user_id;
  IF v_user_name IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF _operation = 'add' THEN
    v_signed_amount := _amount;
    v_tx_type := 'membership_bonus'::transaction_type;
    v_description := 'Admin added money: ' || _reason;

    IF _wallet_type = 'pending'::wallet_type THEN
      PERFORM pg_advisory_xact_lock(hashtext('complete_batch:' || _user_id::text));

      SELECT COUNT(*) INTO v_spot_count FROM public.spots
        WHERE user_id = _user_id AND status = 'active';

      SELECT COALESCE(NULLIF(drop_target_amount, 0), drop_profit_amount)
        INTO v_cap_per_spot FROM public.platform_config WHERE id = 1;

      v_cap := COALESCE(v_cap_per_spot, 0) * COALESCE(v_spot_count, 0);
      v_current_balance := public.get_pending_balance(_user_id);

      IF v_cap > 0 AND v_current_balance + v_signed_amount > v_cap THEN
        RAISE EXCEPTION 'Would overshoot basket cap. Current pending: %, cap: %, requested add: %',
          v_current_balance, v_cap, _amount;
      END IF;
    END IF;
  ELSE
    v_signed_amount := -_amount;
    v_tx_type := 'admin_expense'::transaction_type;
    v_description := 'Admin removed money: ' || _reason;

    SELECT COALESCE(SUM(amount), 0) INTO v_current_balance
    FROM public.transactions
    WHERE user_id = _user_id AND wallet_type = _wallet_type;

    IF v_current_balance + v_signed_amount < 0 THEN
      RAISE EXCEPTION 'Not enough balance. Current %: %, trying to remove: %', _wallet_type, v_current_balance, _amount;
    END IF;
  END IF;

  INSERT INTO public.transactions (
    user_id, wallet_type, amount, transaction_type, description, status, metadata
  ) VALUES (
    _user_id, _wallet_type, v_signed_amount, v_tx_type,
    v_description, 'completed'::transaction_status,
    jsonb_build_object(
      'admin_action', true,
      'admin_id', _admin_id,
      'operation', _operation,
      'reason', _reason,
      'adjusted_at', NOW()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_name', v_user_name,
    'amount', _amount,
    'wallet_type', _wallet_type,
    'operation', _operation
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.atomic_admin_adjust_balance(uuid, numeric, wallet_type, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_admin_adjust_balance(uuid, numeric, wallet_type, text, text, uuid) TO service_role;

-- F2 (P0): serialise cash-out with complete_batch on the same user.
CREATE OR REPLACE FUNCTION public.consume_pending_for_cycle(
  _user_id uuid, _profit_target numeric, _spot_id uuid, _drop_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_available numeric; v_payable numeric;
BEGIN
  IF _user_id IS NULL OR _profit_target IS NULL OR _profit_target <= 0 THEN
    RETURN jsonb_build_object('paid', 0, 'target', COALESCE(_profit_target,0), 'forfeited', 0);
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('complete_batch:' || _user_id::text));
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

-- F5 (P1): sweep any leftover pending on retirement so the next basket starts clean.
CREATE OR REPLACE FUNCTION public.retire_all_active_spots(_user_id uuid, _profit numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_retired int;
  v_active_before int;
  v_leftover numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('complete_batch:' || _user_id::text));

  SELECT COUNT(*) INTO v_active_before FROM public.spots WHERE user_id=_user_id AND status='active';
  IF v_active_before <= 0 THEN
    RETURN jsonb_build_object('retired', 0);
  END IF;

  UPDATE public.spots
     SET status = 'retired',
         total_cycles = total_cycles + 1,
         total_earnings = total_earnings + ( COALESCE(_profit,0) / v_active_before )
   WHERE user_id = _user_id AND status = 'active';
  GET DIAGNOSTICS v_retired = ROW_COUNT;

  v_leftover := public.get_pending_balance(_user_id);
  IF v_leftover > 0 THEN
    INSERT INTO public.transactions (
      user_id, wallet_type, amount, transaction_type, description, status, metadata
    ) VALUES (
      _user_id, 'pending'::wallet_type, -v_leftover,
      'pending_reconciliation'::transaction_type,
      'Cleared leftover pending after basket cash-out',
      'completed'::transaction_status,
      jsonb_build_object('reason','post_retire_sweep','amount',v_leftover,'active_before',v_active_before)
    );
  END IF;

  RETURN jsonb_build_object('retired', v_retired, 'pending_swept', COALESCE(v_leftover, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.retire_all_active_spots(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retire_all_active_spots(uuid, numeric) TO service_role;

-- F7/F8/F9: harden pay_referrer_activation_bonus
CREATE OR REPLACE FUNCTION public.pay_referrer_activation_bonus(_referee_id uuid, _referred_by_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code TEXT;
  v_referrer_id UUID;
  v_referrer_code_of_referrer TEXT;
  v_referee_code TEXT;
  v_referrer_is_banned BOOLEAN;
  v_cash_amount NUMERIC;
  v_pending_bump_configured NUMERIC;
  v_pending_bump_actual NUMERIC;
  v_referee_name TEXT;
  v_already_paid BOOLEAN;
  v_already_bumped BOOLEAN;
  v_referrer_spots INT;
  v_referrer_cap NUMERIC;
  v_referrer_pending NUMERIC;
  v_room NUMERIC;
  v_cap_per_spot NUMERIC;
BEGIN
  v_code := TRIM(COALESCE(_referred_by_code, ''));
  IF v_code = '' OR UPPER(v_code) = 'SYSTEM' THEN RETURN; END IF;

  SELECT id, COALESCE(is_banned, false), referred_by_code
    INTO v_referrer_id, v_referrer_is_banned, v_referrer_code_of_referrer
    FROM profiles WHERE referral_code = v_code;
  IF v_referrer_id IS NULL OR v_referrer_id = _referee_id THEN RETURN; END IF;
  IF v_referrer_is_banned THEN RETURN; END IF;

  SELECT referral_code INTO v_referee_code FROM profiles WHERE id = _referee_id;
  IF v_referee_code IS NOT NULL AND v_referrer_code_of_referrer IS NOT NULL
     AND TRIM(v_referrer_code_of_referrer) = v_referee_code THEN
    RETURN;
  END IF;

  SELECT referral_cash_bonus, referral_pending_bonus,
         COALESCE(NULLIF(drop_target_amount, 0), drop_profit_amount)
    INTO v_cash_amount, v_pending_bump_configured, v_cap_per_spot
    FROM platform_config WHERE id = 1;

  SELECT full_name INTO v_referee_name FROM profiles WHERE id = _referee_id;

  IF v_cash_amount IS NOT NULL AND v_cash_amount > 0 THEN
    SELECT EXISTS(
      SELECT 1 FROM transactions
      WHERE user_id = v_referrer_id
        AND transaction_type = 'referral_payout'
        AND wallet_type = 'earnings'
        AND metadata->>'referee_id' = _referee_id::text
        AND metadata->>'paid_on' = 'activation'
    ) INTO v_already_paid;

    IF NOT v_already_paid THEN
      INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
      VALUES (
        v_referrer_id, 'earnings', v_cash_amount, 'referral_payout',
        format('Referral bonus - %s activated', COALESCE(v_referee_name, 'your friend')),
        'completed',
        jsonb_build_object('referee_id', _referee_id, 'referee_name', v_referee_name, 'paid_on', 'activation')
      );
    END IF;
  END IF;

  IF v_pending_bump_configured IS NOT NULL AND v_pending_bump_configured > 0 THEN
    SELECT EXISTS(
      SELECT 1 FROM transactions
      WHERE user_id = v_referrer_id
        AND transaction_type = 'task_earning'
        AND wallet_type = 'pending'
        AND metadata->>'source' = 'referral_pending_bump'
        AND metadata->>'referee_id' = _referee_id::text
    ) INTO v_already_bumped;

    IF NOT v_already_bumped THEN
      PERFORM pg_advisory_xact_lock(hashtext('complete_batch:' || v_referrer_id::text));

      SELECT COUNT(*) INTO v_referrer_spots FROM spots
        WHERE user_id = v_referrer_id AND status = 'active';

      IF v_referrer_spots > 0 THEN
        v_referrer_cap := v_cap_per_spot * v_referrer_spots;
        v_referrer_pending := public.get_pending_balance(v_referrer_id);
        v_room := GREATEST(v_referrer_cap - v_referrer_pending, 0);
        v_pending_bump_actual := LEAST(v_pending_bump_configured, v_room);

        IF v_pending_bump_actual > 0 THEN
          INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
          VALUES (
            v_referrer_id, 'pending', v_pending_bump_actual, 'task_earning',
            format('Referral shortcut - %s activated', COALESCE(v_referee_name, 'your friend')),
            'completed',
            jsonb_build_object(
              'source', 'referral_pending_bump',
              'referee_id', _referee_id,
              'referee_name', v_referee_name,
              'configured_amount', v_pending_bump_configured,
              'actual_amount', v_pending_bump_actual,
              'referrer_spot_count', v_referrer_spots,
              'referrer_cap', v_referrer_cap,
              'referrer_pending_before', v_referrer_pending,
              'reason', CASE WHEN v_pending_bump_actual < v_pending_bump_configured THEN 'capped_at_room' ELSE 'full' END
            )
          );
        END IF;
      END IF;
    END IF;
  END IF;

  IF NOT COALESCE(v_already_paid, true) OR NOT COALESCE(v_already_bumped, true) THEN
    PERFORM create_notification(
      _user_id := v_referrer_id,
      _type := 'referral_bonus_paid',
      _title := format('%s just activated!', COALESCE(v_referee_name, 'Your friend')),
      _message := CASE
        WHEN COALESCE(v_pending_bump_actual, 0) > 0 THEN
          format('₦%s cash added to your earnings + ₦%s jumped into your pending balance. Your line just got shorter.',
            v_cash_amount, v_pending_bump_actual)
        ELSE
          format('₦%s added to your earnings balance.', v_cash_amount)
        END,
      _metadata := jsonb_build_object(
        'referee_id', _referee_id,
        'cash_amount', v_cash_amount,
        'pending_bump', COALESCE(v_pending_bump_actual, 0)
      )::jsonb,
      _link := '/wallet'
    );
  END IF;
END;
$function$;

-- F6 (P1): reversal RPC.
CREATE OR REPLACE FUNCTION public.reverse_referrer_activation_bonus(_referee_id uuid, _reason text DEFAULT 'refund')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cash_tx RECORD;
  v_bump_tx RECORD;
  v_cash_reversed numeric := 0;
  v_bump_reversed numeric := 0;
  v_earnings_bal numeric;
  v_pending_bal numeric;
  v_cash_take numeric;
  v_bump_take numeric;
BEGIN
  IF _referee_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing referee');
  END IF;

  SELECT id, user_id, amount INTO v_cash_tx
    FROM transactions
    WHERE transaction_type = 'referral_payout'
      AND wallet_type = 'earnings'
      AND metadata->>'referee_id' = _referee_id::text
      AND metadata->>'paid_on' = 'activation'
      AND NOT (metadata ? 'reversed_at')
    LIMIT 1;

  IF FOUND AND v_cash_tx.amount > 0 THEN
    PERFORM pg_advisory_xact_lock(hashtext('complete_batch:' || v_cash_tx.user_id::text));
    SELECT COALESCE(SUM(amount), 0) INTO v_earnings_bal
      FROM transactions WHERE user_id = v_cash_tx.user_id AND wallet_type = 'earnings';
    v_cash_take := LEAST(v_cash_tx.amount, GREATEST(v_earnings_bal, 0));
    IF v_cash_take > 0 THEN
      INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
      VALUES (
        v_cash_tx.user_id, 'earnings', -v_cash_take, 'admin_expense',
        'Referral bonus reversed (friend payment refunded)', 'completed',
        jsonb_build_object('source','referral_reversal','referee_id',_referee_id,
          'original_tx_id', v_cash_tx.id, 'reason', _reason, 'clamped', v_cash_take < v_cash_tx.amount)
      );
      UPDATE transactions
        SET metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('reversed_at', now()::text, 'reversal_reason', _reason)
        WHERE id = v_cash_tx.id;
      v_cash_reversed := v_cash_take;
    END IF;
  END IF;

  SELECT id, user_id, amount INTO v_bump_tx
    FROM transactions
    WHERE transaction_type = 'task_earning'
      AND wallet_type = 'pending'
      AND metadata->>'source' = 'referral_pending_bump'
      AND metadata->>'referee_id' = _referee_id::text
      AND NOT (metadata ? 'reversed_at')
    LIMIT 1;

  IF FOUND AND v_bump_tx.amount > 0 THEN
    PERFORM pg_advisory_xact_lock(hashtext('complete_batch:' || v_bump_tx.user_id::text));
    v_pending_bal := public.get_pending_balance(v_bump_tx.user_id);
    v_bump_take := LEAST(v_bump_tx.amount, GREATEST(v_pending_bal, 0));
    IF v_bump_take > 0 THEN
      INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
      VALUES (
        v_bump_tx.user_id, 'pending', -v_bump_take, 'pending_reconciliation',
        'Referral shortcut reversed (friend payment refunded)', 'completed',
        jsonb_build_object('source','referral_reversal','referee_id',_referee_id,
          'original_tx_id', v_bump_tx.id, 'reason', _reason, 'clamped', v_bump_take < v_bump_tx.amount)
      );
      UPDATE transactions
        SET metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('reversed_at', now()::text, 'reversal_reason', _reason)
        WHERE id = v_bump_tx.id;
      v_bump_reversed := v_bump_take;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'cash_reversed', v_cash_reversed,
    'pending_bump_reversed', v_bump_reversed
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.reverse_referrer_activation_bonus(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_referrer_activation_bonus(uuid, text) TO service_role;
