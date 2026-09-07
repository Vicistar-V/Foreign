CREATE OR REPLACE FUNCTION public.distribute_liquidity(_origin_drop_id uuid, _amount numeric, _max_depth integer DEFAULT 100)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_remaining NUMERIC := _amount;
  v_distributed NUMERIC := 0;
  v_payouts_made INTEGER := 0;
  v_reentries_made INTEGER := 0;
  v_depth INTEGER := 0;
  v_target_drop RECORD;
  v_config RECORD;
  v_amount_to_fill NUMERIC;
  v_overflow NUMERIC;
  v_spot_owner_id UUID;
  v_should_auto_compound BOOLEAN;
  v_is_first_cycle BOOLEAN;
  v_has_referrer BOOLEAN;
  v_actual_profit NUMERIC;
BEGIN
  SELECT * INTO v_config FROM public.platform_config WHERE id = 1;

  WHILE v_remaining > 0 AND v_depth < _max_depth LOOP
    v_depth := v_depth + 1;

    SELECT d.*, s.id AS spot_id, s.user_id AS spot_owner_id,
           p.auto_compound_enabled, p.referred_by_code, p.first_cycle_completed_at
    INTO v_target_drop
    FROM public.drops d
    JOIN public.spots s ON s.id = d.spot_id
    JOIN public.profiles p ON p.id = s.user_id
    WHERE d.id != _origin_drop_id
      AND d.status IN ('waiting', 'filling')
      AND d.fill_amount < d.target_amount
    ORDER BY d.position ASC
    LIMIT 1;

    IF v_target_drop IS NULL THEN
      EXIT;
    END IF;

    v_amount_to_fill := LEAST(v_remaining, v_target_drop.target_amount - v_target_drop.fill_amount);

    UPDATE public.drops
       SET fill_amount = fill_amount + v_amount_to_fill,
           status = CASE WHEN fill_amount + v_amount_to_fill >= target_amount THEN 'completed' ELSE 'filling' END,
           completed_at = CASE WHEN fill_amount + v_amount_to_fill >= target_amount THEN now() ELSE NULL END
     WHERE id = v_target_drop.id;

    v_remaining := v_remaining - v_amount_to_fill;
    v_distributed := v_distributed + v_amount_to_fill;

    IF v_target_drop.fill_amount + v_amount_to_fill >= v_target_drop.target_amount THEN
      v_spot_owner_id := v_target_drop.spot_owner_id;
      v_should_auto_compound := COALESCE(v_target_drop.auto_compound_enabled, false);
      v_is_first_cycle := (v_target_drop.first_cycle_completed_at IS NULL);
      v_has_referrer := (
        v_target_drop.referred_by_code IS NOT NULL
        AND v_target_drop.referred_by_code != ''
        AND v_target_drop.referred_by_code != 'SYSTEM'
      );

      v_actual_profit := CASE
        WHEN v_is_first_cycle THEN v_config.drop_profit_amount
        ELSE v_config.drop_profit_amount_subsequent
      END;

      v_payouts_made := v_payouts_made + 1;

      -- Referrer recurring cycle thank-you: pay on EVERY completed cycle,
      -- including the first cycle. This is independent of pending balance.
      -- The old extra ₦500 first-cycle referral bonus is intentionally not paid here,
      -- because ₦500 is already paid immediately when the friend activates.
      IF v_has_referrer AND COALESCE(v_config.drop_referral_per_cycle, 0) > 0 THEN
        PERFORM public.pay_referral_bonus(
          v_target_drop.referred_by_code,
          v_spot_owner_id,
          v_config.drop_referral_per_cycle
        );
      END IF;

      PERFORM public.pay_user_profit(
        v_spot_owner_id,
        v_target_drop.spot_id,
        v_config.drop_profit_amount,
        v_should_auto_compound
      );

      UPDATE public.profiles SET last_payout_at = NOW() WHERE id = v_spot_owner_id;

      PERFORM public.pay_admin_fee(
        v_target_drop.id,
        v_spot_owner_id,
        v_config.drop_admin_fee,
        false
      );

      PERFORM public.update_spot_stats(v_target_drop.spot_id, v_actual_profit);

      UPDATE public.drops SET status = 'paid', paid_at = now() WHERE id = v_target_drop.id;

      IF NOT (SELECT is_genesis_spot AND genesis_yields_remaining >= 0 FROM public.spots WHERE id = v_target_drop.spot_id) THEN
        PERFORM public.send_payout_notification(
          v_spot_owner_id,
          v_actual_profit,
          v_should_auto_compound
        );
      END IF;

      INSERT INTO public.drops (spot_id, position, target_amount, fill_amount, status, source_type)
      VALUES (
        v_target_drop.spot_id,
        (SELECT COALESCE(MAX(position), 0) + 1 FROM public.drops),
        v_config.drop_target_amount,
        0,
        'waiting',
        're-entry'
      );
      v_reentries_made := v_reentries_made + 1;

      v_overflow := (v_target_drop.fill_amount + v_amount_to_fill) - v_target_drop.target_amount;
      IF v_overflow > 0 THEN
        v_remaining := v_remaining + v_overflow;
      END IF;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'distributed', v_distributed,
    'payouts_made', v_payouts_made,
    'reentries_made', v_reentries_made,
    'remaining', v_remaining,
    'depth', v_depth
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_user_profit(_user_id uuid, _spot_id uuid, _profit_amount numeric, _auto_compound boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_spot RECORD;
  v_profile RECORD;
  v_actual_profit NUMERIC;
  v_is_first_cycle BOOLEAN;
BEGIN
  SELECT is_genesis_spot, genesis_yields_remaining INTO v_spot FROM public.spots WHERE id = _spot_id;
  SELECT first_cycle_completed_at, auto_compound_enabled
  INTO v_profile FROM public.profiles WHERE id = _user_id;

  v_is_first_cycle := (v_profile.first_cycle_completed_at IS NULL);
  v_actual_profit := public.get_user_profit_amount(_user_id);

  IF v_is_first_cycle THEN
    UPDATE public.profiles SET first_cycle_completed_at = now() WHERE id = _user_id;
  END IF;

  IF v_spot.is_genesis_spot AND v_spot.genesis_yields_remaining > 0 THEN
    PERFORM public.pay_genesis_yield(_user_id, _spot_id, v_actual_profit, v_is_first_cycle);
    RETURN;
  END IF;

  INSERT INTO public.transactions (user_id, amount, transaction_type, wallet_type, description, status, metadata)
  VALUES (
    _user_id, v_actual_profit, 'drop_profit', 'earnings',
    CASE
      WHEN v_is_first_cycle THEN 'First machine payout - Welcome to Viketa!'
      WHEN _auto_compound THEN 'Machine payout (Empire Builder active)'
      ELSE 'Machine payout - Ready to withdraw!'
    END,
    'completed',
    json_build_object('spot_id', _spot_id, 'auto_compounded', _auto_compound,
      'is_first_cycle', v_is_first_cycle, 'profit_amount', v_actual_profit)
  );

  -- No referral money is paid here. The caller handles the recurring ₦20 once
  -- per completed cycle, and activation already handles the ₦500 bonus.
  PERFORM public.send_payout_notification(_user_id, v_actual_profit, _auto_compound);

  IF _auto_compound OR v_profile.auto_compound_enabled THEN
    PERFORM public.try_auto_buy_machine(_user_id);
  END IF;
END;
$$;