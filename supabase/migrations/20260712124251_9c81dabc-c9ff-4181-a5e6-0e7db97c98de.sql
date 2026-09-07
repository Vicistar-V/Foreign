
CREATE OR REPLACE FUNCTION public.extend_drop_target(_drop_id uuid, _delta numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.drops
     SET target_amount = COALESCE(target_amount, 0) + _delta
   WHERE id = _drop_id;
END;
$$;

REVOKE ALL ON FUNCTION public.extend_drop_target(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.extend_drop_target(uuid, numeric) TO service_role;
