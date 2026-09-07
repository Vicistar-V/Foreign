
-- Always return the flat profit amount; first-cycle special case removed
CREATE OR REPLACE FUNCTION public.get_user_profit_amount(_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_amount NUMERIC;
BEGIN
  SELECT drop_profit_amount_subsequent INTO v_amount
  FROM platform_config WHERE id = 1;
  RETURN COALESCE(v_amount, 900);
END;
$function$;

-- Reflect that referral bonuses are paid immediately on activation
UPDATE public.platform_config
SET referral_payout_trigger = 'ON_ACTIVATION'
WHERE id = 1;
