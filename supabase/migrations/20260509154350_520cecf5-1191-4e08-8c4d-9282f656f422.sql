-- Stop browser-side profile edits from touching sensitive fields.
-- Normal profile actions already go through secure Edge Functions using the service role.
REVOKE UPDATE ON public.profiles FROM anon, authenticated;

-- The only direct browser profile change currently used by the app is the user's own auto-compound setting.
GRANT UPDATE (auto_compound_enabled) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;