DROP FUNCTION IF EXISTS public.pay_referrer_activation_bonus(uuid, text);

CREATE OR REPLACE FUNCTION public.pay_referrer_activation_bonus(
  _referee_id uuid,
  _referred_by_code text,
  _shares integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_referrer_id UUID;
  v_referrer_code_of_referrer TEXT;
  v_referee_code TEXT;
  v_referrer_is_banned BOOLEAN;
  v_cash_rate NUMERIC;
  v_cash_amount NUMERIC;
  v_shares INT;
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

  v_shares := GREATEST(1, LEAST(COALESCE(_shares, 1), 100));

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
    INTO v_cash_rate, v_pending_bump_configured, v_cap_per_spot
    FROM platform_config WHERE id = 1;

  SELECT full_name INTO v_referee_name FROM profiles WHERE id = _referee_id;

  v_cash_amount := COALESCE(v_cash_rate, 0) * v_shares;

  IF v_cash_amount > 0 THEN
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
        format('Invite bonus - %s got %s ad share%s',
               COALESCE(v_referee_name, 'your friend'),
               v_shares,
               CASE WHEN v_shares = 1 THEN '' ELSE 's' END),
        'completed',
        jsonb_build_object(
          'referee_id', _referee_id,
          'referee_name', v_referee_name,
          'paid_on', 'activation',
          'shares', v_shares,
          'rate_per_share', v_cash_rate
        )
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
            format('Invite shortcut - %s activated', COALESCE(v_referee_name, 'your friend')),
            'completed',
            jsonb_build_object(
              'source', 'referral_pending_bump',
              'referee_id', _referee_id,
              'referee_name', v_referee_name,
              'configured_amount', v_pending_bump_configured,
              'actual_amount', v_pending_bump_actual,
              'reason', CASE WHEN v_pending_bump_actual < v_pending_bump_configured THEN 'capped_at_room' ELSE 'full' END,
              'referrer_spot_count', v_referrer_spots,
              'referrer_cap_per_spot', v_cap_per_spot,
              'referrer_cap', v_referrer_cap,
              'referrer_pending_before', v_referrer_pending,
              'referrer_room_before', v_room
            )
          );
        END IF;
      END IF;
    END IF;
  END IF;

  BEGIN
    PERFORM public.create_notification(
      v_referrer_id,
      'referral_bonus',
      'Invite bonus paid!',
      format('%s joined with %s ad share%s. ₦%s added to your money you can cash out.',
             COALESCE(v_referee_name, 'Your friend'),
             v_shares,
             CASE WHEN v_shares = 1 THEN '' ELSE 's' END,
             to_char(v_cash_amount, 'FM999,999,999')),
      jsonb_build_object('referee_id', _referee_id, 'amount', v_cash_amount, 'shares', v_shares),
      '/invite'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;