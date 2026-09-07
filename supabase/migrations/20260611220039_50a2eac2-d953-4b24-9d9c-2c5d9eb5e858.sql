CREATE OR REPLACE FUNCTION public.save_my_birth_date(_birth_year int, _birth_month int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_current_year int := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Africa/Lagos'))::int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  IF _birth_year IS NULL OR _birth_year < 1900 OR _birth_year > v_current_year - 13 THEN
    RAISE EXCEPTION 'Invalid birth year';
  END IF;

  IF _birth_month IS NULL OR _birth_month < 1 OR _birth_month > 12 THEN
    RAISE EXCEPTION 'Invalid birth month';
  END IF;

  UPDATE public.profiles
  SET birth_year = _birth_year,
      birth_month = _birth_month
  WHERE id = v_uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_my_birth_date(int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_my_birth_date(int, int) TO authenticated;