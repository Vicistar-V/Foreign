CREATE OR REPLACE FUNCTION public.get_platform_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(c) - 'admin_alert_email'
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