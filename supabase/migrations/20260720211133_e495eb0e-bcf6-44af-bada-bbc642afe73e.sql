CREATE OR REPLACE FUNCTION public.save_my_state_of_residence(_state text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _state IS NULL OR length(trim(_state)) = 0 THEN
    RAISE EXCEPTION 'State is required';
  END IF;
  UPDATE public.profiles
     SET state_of_residence = trim(_state)
   WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_my_state_of_residence(text) TO authenticated;