-- Drop the heavy trigger guards on profiles. Column-level GRANTs already
-- prevent regular users from editing pin_hash, is_member, is_banned, etc.

DROP TRIGGER IF EXISTS keep_profile_pin_server_only ON public.profiles;
DROP TRIGGER IF EXISTS stop_users_changing_locked_profile_fields ON public.profiles;
DROP TRIGGER IF EXISTS trg_prevent_profile_privileged_update ON public.profiles;

DROP FUNCTION IF EXISTS public.keep_profile_pin_server_only() CASCADE;
DROP FUNCTION IF EXISTS public.stop_users_changing_locked_profile_fields() CASCADE;
DROP FUNCTION IF EXISTS public.prevent_profile_privileged_update() CASCADE;

-- Recreate PIN helpers without the trigger-bypass plumbing.
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

CREATE OR REPLACE FUNCTION public.change_user_pin(_old_pin text, _new_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_hash text;
  v_new_hash text;
  v_updated integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'auth');
  END IF;

  IF _old_pin IS NULL OR _old_pin !~ '^\d{4}$' OR _new_pin IS NULL OR _new_pin !~ '^\d{4}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'pin_must_be_4_digits');
  END IF;

  SELECT pin_hash INTO v_hash
    FROM public.profiles
   WHERE id = v_user;

  IF v_hash IS NULL OR length(v_hash) = 0 OR left(v_hash, 2) <> '$2' THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_pin_set');
  END IF;

  IF crypt(_old_pin, v_hash) <> v_hash THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_pin');
  END IF;

  v_new_hash := crypt(_new_pin, gen_salt('bf', 10));

  UPDATE public.profiles
     SET pin_hash = v_new_hash
   WHERE id = v_user;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.set_user_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_user_pin(text, text) TO authenticated;