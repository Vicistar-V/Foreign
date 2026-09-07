CREATE OR REPLACE FUNCTION public.prevent_privileged_profile_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.is_member IS DISTINCT FROM OLD.is_member
    OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
    OR NEW.banned_at IS DISTINCT FROM OLD.banned_at
    OR NEW.banned_reason IS DISTINCT FROM OLD.banned_reason
    OR NEW.referral_code IS DISTINCT FROM OLD.referral_code
    OR NEW.referred_by_code IS DISTINCT FROM OLD.referred_by_code
    OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'You are not allowed to change protected profile fields';
  END IF;

  RETURN NEW;
END;
$function$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

UPDATE public.profiles p
SET activated_at = sub.first_tx
FROM (
  SELECT user_id, MIN(created_at) AS first_tx
  FROM public.transactions
  WHERE transaction_type = 'membership_fee' AND status = 'completed'
  GROUP BY user_id
) sub
WHERE p.id = sub.user_id AND p.activated_at IS NULL;

UPDATE public.profiles
SET activated_at = created_at
WHERE is_member = true AND activated_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_activated_at_on_member_flip()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_member = true AND (OLD.is_member IS DISTINCT FROM true) AND NEW.activated_at IS NULL THEN
    NEW.activated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_activated_at ON public.profiles;
CREATE TRIGGER trg_set_activated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_activated_at_on_member_flip();

CREATE INDEX IF NOT EXISTS idx_profiles_activated_at ON public.profiles(activated_at) WHERE activated_at IS NOT NULL;