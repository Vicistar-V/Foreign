-- Let only the secure PIN helpers update pin_hash while keeping normal profile edits blocked.
CREATE OR REPLACE FUNCTION public.stop_users_changing_locked_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'authenticated'
     AND auth.uid() = OLD.id
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.is_member IS DISTINCT FROM OLD.is_member
       OR (
            NEW.pin_hash IS DISTINCT FROM OLD.pin_hash
            AND current_setting('app.secure_pin_update', true) IS DISTINCT FROM 'on'
          )
       OR NEW.referral_code IS DISTINCT FROM OLD.referral_code
       OR NEW.referred_by_code IS DISTINCT FROM OLD.referred_by_code
       OR NEW.is_name_locked IS DISTINCT FROM OLD.is_name_locked
       OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
       OR NEW.banned_at IS DISTINCT FROM OLD.banned_at
       OR NEW.banned_reason IS DISTINCT FROM OLD.banned_reason
       OR NEW.last_payout_at IS DISTINCT FROM OLD.last_payout_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.metadata IS DISTINCT FROM OLD.metadata THEN
      RAISE EXCEPTION 'This profile setting can only be changed by the secure backend.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_user_pin(_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_hash text;
  v_updated integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'auth');
  END IF;

  IF _pin IS NULL OR _pin !~ '^\d{4}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'pin_must_be_4_digits');
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

  PERFORM set_config('app.secure_pin_update', 'on', true);

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
GRANT EXECUTE ON FUNCTION public.verify_user_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_user_pin(text, text) TO authenticated;