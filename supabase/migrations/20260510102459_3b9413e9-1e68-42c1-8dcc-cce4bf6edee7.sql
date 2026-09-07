-- Allow secure PIN helper updates through the older PIN-only guard.
CREATE OR REPLACE FUNCTION public.keep_profile_pin_server_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role'
     OR public.has_role(auth.uid(), 'admin'::public.app_role)
     OR current_setting('app.secure_pin_update', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.pin_hash IS DISTINCT FROM OLD.pin_hash THEN
    RAISE EXCEPTION 'PIN setup can only be changed securely by the server';
  END IF;

  RETURN NEW;
END;
$function$;

-- Do not silently undo secure PIN helper updates.
CREATE OR REPLACE FUNCTION public.prevent_profile_privileged_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_secure_pin_update boolean := current_setting('app.secure_pin_update', true) = 'on';
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  NEW.id := OLD.id;
  NEW.is_member := OLD.is_member;
  NEW.is_banned := OLD.is_banned;
  NEW.banned_at := OLD.banned_at;
  NEW.banned_reason := OLD.banned_reason;

  IF NOT v_secure_pin_update THEN
    NEW.pin_hash := OLD.pin_hash;
  END IF;

  NEW.referral_code := OLD.referral_code;
  NEW.referred_by_code := OLD.referred_by_code;
  NEW.is_name_locked := OLD.is_name_locked;
  NEW.last_payout_at := OLD.last_payout_at;
  NEW.created_at := OLD.created_at;

  IF OLD.is_name_locked THEN
    NEW.full_name := OLD.full_name;
  END IF;

  RETURN NEW;
END;
$function$;