-- Stop broadcasting tables that contain sensitive or linkable data through Realtime.
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
ALTER PUBLICATION supabase_realtime DROP TABLE public.platform_config;
ALTER PUBLICATION supabase_realtime DROP TABLE public.drops;

-- Remove the overly broad public queue read rule that exposed raw spot IDs.
DROP POLICY IF EXISTS "Anyone can view drop positions for transparency" ON public.drops;

-- Defense in depth: browser clients should not be able to write payment attempt records.
REVOKE INSERT, UPDATE, DELETE ON public.payment_attempts FROM anon, authenticated;
GRANT SELECT ON public.payment_attempts TO authenticated;
GRANT ALL ON public.payment_attempts TO service_role;