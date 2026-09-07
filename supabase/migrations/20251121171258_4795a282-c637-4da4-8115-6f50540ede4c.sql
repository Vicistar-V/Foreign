-- Add pin_secret column to platform_config to store the JWT secret for PIN hashing
ALTER TABLE public.platform_config ADD COLUMN pin_secret TEXT;

-- Update verify_pin function to use SHA-256 matching create-pin logic
CREATE OR REPLACE FUNCTION public.verify_pin(_user_id uuid, _pin_attempt text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_stored_hash TEXT;
  v_computed_hash TEXT;
  v_secret TEXT;
BEGIN
  -- Get the stored PIN hash from user profile
  SELECT pin_hash INTO v_stored_hash
  FROM public.profiles
  WHERE id = _user_id;
  
  IF v_stored_hash IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get the PIN secret from platform_config
  SELECT pin_secret INTO v_secret
  FROM public.platform_config
  WHERE id = 1;
  
  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'PIN secret not configured in platform_config';
  END IF;
  
  -- Compute SHA-256 hash: pin + secret (matching create-pin edge function)
  -- encode(digest(data, 'sha256'), 'hex') produces the same hex string as JavaScript
  v_computed_hash := encode(
    digest(_pin_attempt || v_secret, 'sha256'),
    'hex'
  );
  
  -- Compare the computed hash with stored hash
  RETURN v_computed_hash = v_stored_hash;
END;
$function$;