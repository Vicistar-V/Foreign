
DO $$
DECLARE
  r RECORD;
  v_referee_name TEXT;
BEGIN
  FOR r IN
    SELECT pb.id, pb.referrer_id, pb.referee_id, pb.amount
    FROM pending_referral_bonuses pb
    JOIN profiles refr ON refr.id = pb.referrer_id
    WHERE pb.status = 'pending'
  LOOP
    SELECT full_name INTO v_referee_name FROM profiles WHERE id = r.referee_id;

    INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
    VALUES (
      r.referrer_id, 'earnings', r.amount, 'referral_payout',
      format('Referral bonus - %s activated', COALESCE(v_referee_name, 'your friend')),
      'completed',
      jsonb_build_object('referee_id', r.referee_id, 'referee_name', v_referee_name,
        'paid_on', 'activation', 'backfilled_from_pending', true)
    );

    PERFORM create_notification(
      _user_id := r.referrer_id,
      _type := 'referral_bonus_paid',
      _title := format('You earned ₦%s!', r.amount),
      _message := format('%s activated. ₦%s has been added to your earnings balance.',
        COALESCE(v_referee_name, 'Your friend'), r.amount),
      _metadata := jsonb_build_object('referee_id', r.referee_id, 'amount', r.amount)::jsonb,
      _link := '/wallet'
    );
  END LOOP;
END $$;

DROP TABLE IF EXISTS public.pending_referral_bonuses CASCADE;
DROP FUNCTION IF EXISTS public.create_pending_referral_bonus(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.pay_first_cycle_referral_bonus(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.mark_first_cycle_done(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.mark_first_cycle_done(text, uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.pay_referrer_activation_bonus(
  _referee_id uuid,
  _referred_by_code text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
  v_bonus_amount NUMERIC;
  v_referee_name TEXT;
  v_already_paid BOOLEAN;
BEGIN
  IF _referred_by_code IS NULL OR _referred_by_code = '' OR _referred_by_code = 'SYSTEM' THEN RETURN; END IF;
  SELECT id INTO v_referrer_id FROM profiles WHERE referral_code = _referred_by_code;
  IF v_referrer_id IS NULL THEN RETURN; END IF;
  SELECT referral_cash_bonus INTO v_bonus_amount FROM platform_config WHERE id = 1;
  IF v_bonus_amount IS NULL OR v_bonus_amount <= 0 THEN RETURN; END IF;

  SELECT EXISTS(
    SELECT 1 FROM transactions
    WHERE user_id = v_referrer_id
      AND transaction_type = 'referral_payout'
      AND wallet_type = 'earnings'
      AND metadata->>'referee_id' = _referee_id::text
      AND metadata->>'paid_on' = 'activation'
  ) INTO v_already_paid;
  IF v_already_paid THEN RETURN; END IF;

  SELECT full_name INTO v_referee_name FROM profiles WHERE id = _referee_id;

  INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES (
    v_referrer_id, 'earnings', v_bonus_amount, 'referral_payout',
    format('Referral bonus - %s activated', COALESCE(v_referee_name, 'your friend')),
    'completed',
    jsonb_build_object('referee_id', _referee_id, 'referee_name', v_referee_name, 'paid_on', 'activation')
  );

  PERFORM create_notification(
    _user_id := v_referrer_id,
    _type := 'referral_bonus_paid',
    _title := format('You earned ₦%s!', v_bonus_amount),
    _message := format('%s just activated. ₦%s has been added to your earnings balance.',
      COALESCE(v_referee_name, 'Your friend'), v_bonus_amount),
    _metadata := jsonb_build_object('referee_id', _referee_id, 'amount', v_bonus_amount)::jsonb,
    _link := '/wallet'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_user_profit(_user_id uuid, _spot_id uuid, _profit_amount numeric, _auto_compound boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spot RECORD;
  v_profile RECORD;
  v_config RECORD;
  v_actual_profit NUMERIC;
  v_is_first_cycle BOOLEAN;
  v_has_referrer BOOLEAN;
BEGIN
  SELECT is_genesis_spot, genesis_yields_remaining INTO v_spot FROM spots WHERE id = _spot_id;
  SELECT first_cycle_completed_at, referred_by_code, auto_compound_enabled
  INTO v_profile FROM profiles WHERE id = _user_id;
  SELECT drop_referral_per_cycle INTO v_config FROM platform_config WHERE id = 1;

  v_is_first_cycle := (v_profile.first_cycle_completed_at IS NULL);
  v_has_referrer := (v_profile.referred_by_code IS NOT NULL
                     AND v_profile.referred_by_code != ''
                     AND v_profile.referred_by_code != 'SYSTEM');

  v_actual_profit := get_user_profit_amount(_user_id);

  IF v_is_first_cycle THEN
    UPDATE profiles SET first_cycle_completed_at = now() WHERE id = _user_id;
  END IF;

  IF v_spot.is_genesis_spot AND v_spot.genesis_yields_remaining > 0 THEN
    PERFORM pay_genesis_yield(_user_id, _spot_id, v_actual_profit, v_is_first_cycle);
    RETURN;
  END IF;

  INSERT INTO transactions (user_id, amount, transaction_type, wallet_type, description, status, metadata)
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

  IF v_has_referrer AND v_config.drop_referral_per_cycle > 0 THEN
    PERFORM pay_referral_bonus(v_profile.referred_by_code, _user_id, v_config.drop_referral_per_cycle);
  END IF;

  PERFORM send_payout_notification(_user_id, v_actual_profit, _auto_compound);

  IF _auto_compound OR v_profile.auto_compound_enabled THEN
    PERFORM try_auto_buy_machine(_user_id);
  END IF;
END;
$$;
