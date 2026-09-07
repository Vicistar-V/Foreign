-- Strip invite_access_key from public config payload
CREATE OR REPLACE FUNCTION public.get_platform_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (to_jsonb(c) - 'admin_alert_email' - 'invite_access_key')
         || jsonb_build_object(
           'drop_profit_amount',
             COALESCE(c.drop_profit_amount_subsequent, c.drop_profit_amount, 900),
           'drop_profit_amount_subsequent',
             COALESCE(c.drop_profit_amount_subsequent, c.drop_profit_amount, 900),
           'drop_profit_amount_first_cycle',
             COALESCE(c.drop_profit_amount_subsequent, c.drop_profit_amount, 900)
         )
  FROM public.platform_config c
  WHERE c.id = 1;
$$;
REVOKE ALL ON FUNCTION public.get_platform_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_platform_config() TO anon, authenticated;

-- Validator: client passes a candidate key, gets back true/false. Key never leaves the DB.
CREATE OR REPLACE FUNCTION public.check_invite_key(_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_config
    WHERE id = 1 AND invite_access_key = _key
  );
$$;
REVOKE ALL ON FUNCTION public.check_invite_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_invite_key(text) TO anon, authenticated;