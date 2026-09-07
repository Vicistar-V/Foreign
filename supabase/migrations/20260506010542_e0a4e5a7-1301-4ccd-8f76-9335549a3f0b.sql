CREATE OR REPLACE FUNCTION public.stop_users_changing_locked_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.role() = 'authenticated'
     AND auth.uid() = OLD.id
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.is_member IS DISTINCT FROM OLD.is_member
       OR NEW.pin_hash IS DISTINCT FROM OLD.pin_hash
       OR NEW.referral_code IS DISTINCT FROM OLD.referral_code
       OR NEW.referred_by_code IS DISTINCT FROM OLD.referred_by_code
       OR NEW.is_name_locked IS DISTINCT FROM OLD.is_name_locked
       OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
       OR NEW.banned_at IS DISTINCT FROM OLD.banned_at
       OR NEW.banned_reason IS DISTINCT FROM OLD.banned_reason
       OR NEW.first_cycle_completed_at IS DISTINCT FROM OLD.first_cycle_completed_at
       OR NEW.genesis_completed_at IS DISTINCT FROM OLD.genesis_completed_at
       OR NEW.last_payout_at IS DISTINCT FROM OLD.last_payout_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.metadata IS DISTINCT FROM OLD.metadata THEN
      RAISE EXCEPTION 'This profile setting can only be changed by the secure backend.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stop_users_changing_locked_profile_fields ON public.profiles;
CREATE TRIGGER stop_users_changing_locked_profile_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.stop_users_changing_locked_profile_fields();

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, phone_number, avatar_url, auto_compound_enabled, last_seen_at)
ON public.profiles TO authenticated;