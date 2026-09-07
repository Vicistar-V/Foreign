-- Bulletproof PIN system using bcrypt (pgcrypto). Salt is embedded in the hash,
-- so there is no dependency on any rotating environment secret.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- set_user_pin(_pin) — hashes and stores the PIN for the caller
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_user_pin(_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_hash text;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'auth');
  END IF;

  IF _pin IS NULL OR _pin !~ '^\d{4}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'pin_must_be_4_digits');
  END IF;

  v_hash := crypt(_pin, gen_salt('bf', 10));

  UPDATE public.profiles
     SET pin_hash = v_hash
   WHERE id = v_user;

  RETURN jsonb_build_object('success', true);
END $$;

GRANT EXECUTE ON FUNCTION public.set_user_pin(text) TO authenticated;

-- =========================================================
-- verify_user_pin(_pin) — checks PIN attempt for the caller
-- =========================================================
CREATE OR REPLACE FUNCTION public.verify_user_pin(_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_hash text;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'valid', false, 'error', 'auth');
  END IF;

  IF _pin IS NULL OR _pin !~ '^\d{4}$' THEN
    RETURN jsonb_build_object('success', false, 'valid', false, 'error', 'pin_must_be_4_digits');
  END IF;

  SELECT pin_hash INTO v_hash
    FROM public.profiles
   WHERE id = v_user;

  IF v_hash IS NULL OR length(v_hash) = 0 THEN
    RETURN jsonb_build_object('success', true, 'valid', false, 'error', 'no_pin_set');
  END IF;

  -- bcrypt hashes start with $2; if anything else is stored (legacy SHA-256),
  -- treat it as no-pin so the user can re-create cleanly.
  IF left(v_hash, 2) <> '$2' THEN
    RETURN jsonb_build_object('success', true, 'valid', false, 'error', 'legacy_hash_reset_required');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'valid',   crypt(_pin, v_hash) = v_hash
  );
END $$;

GRANT EXECUTE ON FUNCTION public.verify_user_pin(text) TO authenticated;

-- =========================================================
-- change_user_pin(_old_pin, _new_pin) — atomic verify-then-update
-- =========================================================
CREATE OR REPLACE FUNCTION public.change_user_pin(_old_pin text, _new_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_hash text;
  v_new_hash text;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'auth');
  END IF;

  IF _new_pin IS NULL OR _new_pin !~ '^\d{4}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'pin_must_be_4_digits');
  END IF;

  SELECT pin_hash INTO v_hash
    FROM public.profiles
   WHERE id = v_user;

  IF v_hash IS NULL OR length(v_hash) = 0 OR left(v_hash, 2) <> '$2' THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_pin_set');
  END IF;

  IF crypt(COALESCE(_old_pin, ''), v_hash) <> v_hash THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_pin');
  END IF;

  v_new_hash := crypt(_new_pin, gen_salt('bf', 10));

  UPDATE public.profiles
     SET pin_hash = v_new_hash
   WHERE id = v_user;

  RETURN jsonb_build_object('success', true);
END $$;

GRANT EXECUTE ON FUNCTION public.change_user_pin(text, text) TO authenticated;