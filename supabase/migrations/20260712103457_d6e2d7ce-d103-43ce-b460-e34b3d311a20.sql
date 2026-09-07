
CREATE OR REPLACE FUNCTION public.get_retirement_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_member boolean;
  v_active integer;
  v_retired integer;
  v_deposit numeric;
  v_earnings numeric;
  v_cfg record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT is_member INTO v_is_member FROM public.profiles WHERE id = v_uid;

  SELECT COUNT(*) FILTER (WHERE status = 'active'),
         COUNT(*) FILTER (WHERE status = 'retired')
  INTO v_active, v_retired
  FROM public.spots WHERE user_id = v_uid;

  SELECT COALESCE(public.check_balance(v_uid, 'deposit'), 0),
         COALESCE(public.check_balance(v_uid, 'earnings'), 0)
  INTO v_deposit, v_earnings;

  SELECT membership_fee, drop_entry_fee, drop_profit_amount
  INTO v_cfg
  FROM public.platform_config WHERE id = 1;

  RETURN jsonb_build_object(
    'is_member', COALESCE(v_is_member, false),
    'active_spots', COALESCE(v_active, 0),
    'previous_capacity', COALESCE(v_retired, 0),
    'is_retired', (COALESCE(v_is_member, false) AND COALESCE(v_active, 0) = 0 AND COALESCE(v_retired, 0) > 0),
    'deposit_balance', v_deposit,
    'earnings_balance', v_earnings,
    'combined_balance', v_deposit + v_earnings,
    'base_fee', COALESCE(v_cfg.membership_fee, 5000),
    'extra_fee', COALESCE(v_cfg.drop_entry_fee, 3000),
    'payout_per_spot', COALESCE(v_cfg.drop_profit_amount, 10000)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_retirement_status() TO authenticated;
