CREATE OR REPLACE FUNCTION public.create_pending_referral_bonus(
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
BEGIN
  IF _referred_by_code IS NULL OR _referred_by_code = '' OR _referred_by_code = 'SYSTEM' THEN
    RETURN;
  END IF;

  SELECT id INTO v_referrer_id
  FROM profiles
  WHERE referral_code = _referred_by_code;

  IF v_referrer_id IS NULL THEN
    RETURN;
  END IF;

  SELECT referral_cash_bonus INTO v_bonus_amount
  FROM platform_config WHERE id = 1;

  IF v_bonus_amount IS NULL OR v_bonus_amount <= 0 THEN
    RETURN;
  END IF;

  SELECT full_name INTO v_referee_name FROM profiles WHERE id = _referee_id;

  -- Pay the bonus immediately into the referrer's EARNINGS balance
  PERFORM write_transaction(
    _amount := v_bonus_amount,
    _description := format('Referral bonus - %s activated', COALESCE(v_referee_name, 'your friend')),
    _transaction_type := 'referral_payout'::transaction_type,
    _user_id := v_referrer_id,
    _wallet_type := 'earnings'::wallet_type,
    _metadata := jsonb_build_object(
      'referee_id', _referee_id,
      'referee_name', v_referee_name,
      'paid_on', 'activation'
    ),
    _status := 'completed'::transaction_status
  );

  -- Mark any existing pending row as paid (legacy cleanup)
  UPDATE pending_referral_bonuses
  SET status = 'paid', paid_at = now()
  WHERE referrer_id = v_referrer_id
    AND referee_id = _referee_id
    AND status = 'pending';

  -- Notify referrer that the bonus was paid
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