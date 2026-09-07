-- Allow admins to view all user profiles
-- This enables the admin mission review page to show user names

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));