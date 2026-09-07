-- Fix can_join_drop to include earnings wallet in eligibility check
-- This allows the smart payment waterfall (credits → deposit → earnings) to work properly

CREATE OR REPLACE FUNCTION public.can_join_drop(_user_id uuid, _current_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(can_join boolean, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_already_joined BOOLEAN;
  v_has_debt BOOLEAN;
  v_drop_active BOOLEAN;
  v_entry_fee DECIMAL(12, 2);
  v_total_available DECIMAL(12, 2);
  v_is_member BOOLEAN;
  v_is_banned BOOLEAN;
BEGIN
  -- Check if user is banned (CRITICAL FIRST CHECK)
  SELECT is_banned INTO v_is_banned FROM public.profiles WHERE id = _user_id;
  IF v_is_banned THEN
    RETURN QUERY SELECT false, 'Your account has been suspended';
    RETURN;
  END IF;

  -- Check if user is a member
  SELECT is_member INTO v_is_member FROM public.profiles WHERE id = _user_id;
  IF NOT v_is_member THEN
    RETURN QUERY SELECT false, 'You must activate your membership first';
    RETURN;
  END IF;

  -- Check if already joined today (using passed Nigerian date)
  SELECT EXISTS(
    SELECT 1 FROM public.drop_entries 
    WHERE user_id = _user_id AND drop_date = _current_date
  ) INTO v_already_joined;
  
  IF v_already_joined THEN
    RETURN QUERY SELECT false, 'You have already joined today';
    RETURN;
  END IF;

  -- Check for negative balances
  SELECT EXISTS(
    SELECT 1 FROM public.user_balances
    WHERE user_id = _user_id 
    AND (earnings_balance < 0 OR deposit_balance < 0 OR credits_balance < 0)
  ) INTO v_has_debt;
  
  IF v_has_debt THEN
    RETURN QUERY SELECT false, 'Please clear your account debt first';
    RETURN;
  END IF;

  -- Check if drop is active
  SELECT is_drop_active, drop_entry_fee INTO v_drop_active, v_entry_fee
  FROM public.platform_config WHERE id = 1;
  
  IF NOT v_drop_active THEN
    RETURN QUERY SELECT false, 'Daily drop is currently closed';
    RETURN;
  END IF;

  -- FIXED: Check if user has enough funds across ALL THREE wallets
  -- This matches the smart payment waterfall: credits → deposit → earnings
  SELECT COALESCE(deposit_balance, 0) + COALESCE(credits_balance, 0) + COALESCE(earnings_balance, 0)
  INTO v_total_available
  FROM public.user_balances
  WHERE user_id = _user_id;
  
  IF v_total_available < v_entry_fee THEN
    RETURN QUERY SELECT false, 'Insufficient funds. Please add money to your deposit wallet';
    RETURN;
  END IF;

  -- All checks passed
  RETURN QUERY SELECT true, 'You can join the drop';
END;
$function$;