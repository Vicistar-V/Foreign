CREATE OR REPLACE FUNCTION public.get_payment_attempt_status(_attempt_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_owner uuid;
BEGIN
  SELECT status, user_id INTO v_status, v_owner
  FROM public.payment_attempts
  WHERE id = _attempt_id;

  IF v_owner IS NULL THEN
    RETURN NULL;
  END IF;

  -- Only the owner (or admin) can read their attempt status
  IF v_owner <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NULL;
  END IF;

  RETURN v_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_payment_attempt_status(uuid) TO authenticated;