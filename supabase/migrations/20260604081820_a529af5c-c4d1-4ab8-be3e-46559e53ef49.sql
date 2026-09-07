
-- 1. Protect privileged profile fields from user updates via trigger
CREATE OR REPLACE FUNCTION public.prevent_privileged_profile_updates()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow service role and admins to change anything
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.is_member IS DISTINCT FROM OLD.is_member
    OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
    OR NEW.banned_at IS DISTINCT FROM OLD.banned_at
    OR NEW.banned_reason IS DISTINCT FROM OLD.banned_reason
    OR NEW.referral_code IS DISTINCT FROM OLD.referral_code
    OR NEW.referred_by IS DISTINCT FROM OLD.referred_by
    OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'You are not allowed to change protected profile fields';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS prevent_privileged_profile_updates_trg ON public.profiles;
CREATE TRIGGER prevent_privileged_profile_updates_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_privileged_profile_updates();

-- 2. Restrict ticket_messages user UPDATE to only the read_at column
CREATE OR REPLACE FUNCTION public.prevent_ticket_message_field_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.ticket_id IS DISTINCT FROM OLD.ticket_id
    OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
    OR NEW.sender_type IS DISTINCT FROM OLD.sender_type
    OR NEW.message IS DISTINCT FROM OLD.message
    OR NEW.image_url IS DISTINCT FROM OLD.image_url
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'You may only mark messages as read';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS prevent_ticket_message_field_changes_trg ON public.ticket_messages;
CREATE TRIGGER prevent_ticket_message_field_changes_trg
BEFORE UPDATE ON public.ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.prevent_ticket_message_field_changes();

-- 3. Add explicit INSERT policy on comparison_seen_log for authenticated users only
DROP POLICY IF EXISTS "Users insert own seen log" ON public.comparison_seen_log;
CREATE POLICY "Users insert own seen log"
ON public.comparison_seen_log
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 4. Remove user_activity_log from realtime publication to prevent broadcast of navigation/session data
ALTER PUBLICATION supabase_realtime DROP TABLE public.user_activity_log;
