-- Update pay_referral_bonus to include referee_name in metadata
-- This ensures royalty transactions show the actual friend's name, not just "Friend"

CREATE OR REPLACE FUNCTION public.pay_referral_bonus(
  _referee_id uuid,
  _referred_by_code text,
  _bonus_amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _referrer_id uuid;
  _referee_name text;
BEGIN
  -- Get referrer's user id from their referral code
  SELECT id INTO _referrer_id
  FROM profiles
  WHERE referral_code = _referred_by_code;
  
  IF _referrer_id IS NULL THEN
    RAISE EXCEPTION 'Referrer not found for code: %', _referred_by_code;
  END IF;
  
  -- Get referee's name for the transaction metadata
  SELECT full_name INTO _referee_name
  FROM profiles
  WHERE id = _referee_id;

  -- Record the referral payout transaction to referrer's earnings
  INSERT INTO transactions (
    user_id,
    wallet_type,
    amount,
    transaction_type,
    description,
    status,
    metadata
  ) VALUES (
    _referrer_id,
    'earnings',
    _bonus_amount,
    'drop_referral_cycle',
    'Cycle royalty from ' || COALESCE(_referee_name, 'friend'),
    'completed',
    jsonb_build_object(
      'referee_id', _referee_id,
      'referee_name', _referee_name
    )
  );
END;
$$;