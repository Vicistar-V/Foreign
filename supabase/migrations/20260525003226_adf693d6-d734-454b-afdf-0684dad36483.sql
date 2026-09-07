
CREATE OR REPLACE FUNCTION public.pay_admin_fee(_drop_id uuid, _from_user_id uuid, _admin_fee numeric, _has_referrer boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Platform fee is retained by not crediting any user wallet.
  -- Referral share is paid separately by the distributor; nothing to do here.
  RETURN;
END;
$function$;
