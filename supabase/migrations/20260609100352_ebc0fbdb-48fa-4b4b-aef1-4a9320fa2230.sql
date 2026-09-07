REVOKE EXECUTE ON FUNCTION public.record_user_heartbeat(text, text, text, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_user_heartbeat(text, text, text, text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_user_heartbeat(text, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_user_heartbeat(text, text, text, text, text, jsonb) TO service_role;