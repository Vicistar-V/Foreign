REVOKE ALL ON public.user_activity_log FROM anon;
REVOKE ALL ON public.user_activity_log FROM PUBLIC;
GRANT INSERT ON public.user_activity_log TO authenticated;
GRANT SELECT ON public.user_activity_log TO authenticated;
GRANT ALL ON public.user_activity_log TO service_role;