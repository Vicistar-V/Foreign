CREATE OR REPLACE FUNCTION public.set_user_pin(_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_existing_hash text;
  v_hash text;
  v_updated integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'auth');
  END IF;

  IF _pin IS NULL OR _pin !~ '^\d{4}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'pin_must_be_4_digits');
  END IF;

  SELECT pin_hash INTO v_existing_hash
    FROM public.profiles
   WHERE id = v_user;

  IF v_existing_hash IS NOT NULL AND length(v_existing_hash) > 0 AND left(v_existing_hash, 2) = '$2' THEN
    RETURN jsonb_build_object('success', false, 'error', 'pin_already_set');
  END IF;

  v_hash := crypt(_pin, gen_salt('bf', 10));

  PERFORM set_config('app.secure_pin_update', 'on', true);

  UPDATE public.profiles
     SET pin_hash = v_hash
   WHERE id = v_user;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.set_user_pin(text) TO authenticated;