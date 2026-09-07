
CREATE OR REPLACE FUNCTION public.mark_explainer_seen(_status text DEFAULT 'watched')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _status NOT IN ('watched', 'skipped') THEN
    _status := 'watched';
  END IF;

  UPDATE public.profiles
  SET
    has_seen_explainer = true,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'explainer_status', _status,
      'explainer_seen_at', to_char(now() AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD"T"HH24:MI:SSOF')
    )
  WHERE id = _uid;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_explainer_seen(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_explainer_seen(text) TO authenticated;
