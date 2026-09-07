GRANT INSERT ON public.user_activity_log TO authenticated;
GRANT SELECT ON public.user_activity_log TO authenticated;
GRANT ALL ON public.user_activity_log TO service_role;

GRANT EXECUTE ON FUNCTION public.record_user_heartbeat(text, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_user_heartbeat(text, text, text, text, text, jsonb) TO service_role;