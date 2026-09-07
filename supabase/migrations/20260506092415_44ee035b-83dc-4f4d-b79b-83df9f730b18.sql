
-- 1) Lock down profile self-updates: prevent users from changing privileged columns
CREATE OR REPLACE FUNCTION public.prevent_profile_privileged_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service role and admins to change anything
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- For regular users, force privileged columns to keep their old value
  NEW.id := OLD.id;
  NEW.is_member := OLD.is_member;
  NEW.is_banned := OLD.is_banned;
  NEW.banned_at := OLD.banned_at;
  NEW.banned_reason := OLD.banned_reason;
  NEW.pin_hash := OLD.pin_hash;
  NEW.referral_code := OLD.referral_code;
  NEW.referred_by_code := OLD.referred_by_code;
  NEW.is_name_locked := OLD.is_name_locked;
  NEW.first_cycle_completed_at := OLD.first_cycle_completed_at;
  NEW.last_payout_at := OLD.last_payout_at;
  NEW.created_at := OLD.created_at;

  -- If the user has a locked name, also prevent name changes
  IF OLD.is_name_locked THEN
    NEW.full_name := OLD.full_name;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_privileged_update ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privileged_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privileged_update();

-- 2) Lock down bank account self-updates: users cannot self-verify or change account_number/code
CREATE OR REPLACE FUNCTION public.prevent_bank_privileged_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  NEW.is_verified := OLD.is_verified;
  NEW.is_primary := OLD.is_primary;
  NEW.account_number := OLD.account_number;
  NEW.bank_code := OLD.bank_code;
  NEW.bank_name := OLD.bank_name;
  NEW.user_id := OLD.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_bank_privileged_update ON public.withdrawal_accounts;
CREATE TRIGGER trg_prevent_bank_privileged_update
BEFORE UPDATE ON public.withdrawal_accounts
FOR EACH ROW
EXECUTE FUNCTION public.prevent_bank_privileged_update();

-- 3) Restrict platform_config SELECT to admins only (edge functions use service role and bypass RLS)
DROP POLICY IF EXISTS "Everyone can view platform config" ON public.platform_config;
CREATE POLICY "Admins can view platform config"
ON public.platform_config
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 4) Make ticket-attachments bucket private (RLS policies on storage.objects already restrict by folder)
UPDATE storage.buckets SET public = false WHERE id = 'ticket-attachments';
