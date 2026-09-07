-- Lock internal money-moving RPC helpers so only backend service-role code can run them.
-- These functions use SECURITY DEFINER and can change financial tables, so browser callers
-- (anon/authenticated) must never be able to execute them directly.

REVOKE EXECUTE ON FUNCTION public.execute_write_batch(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.commit_distribution_batch(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.call_distribute_liquidity_edge(uuid, numeric, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_single_reentry(uuid, uuid, uuid, text, integer, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_distribution_data(uuid, integer) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.write_drop_fill(uuid, numeric, text, timestamp with time zone) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.write_drop_paid(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.write_drop_settled(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.write_new_drop(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.write_reentry_drop(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.write_notification(uuid, text, text, text, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.write_profile_update(uuid, boolean, boolean, numeric, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.write_spot(uuid, text, boolean, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.write_spot_stats(uuid, numeric, integer, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.execute_write_batch(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.commit_distribution_batch(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.call_distribute_liquidity_edge(uuid, numeric, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_single_reentry(uuid, uuid, uuid, text, integer, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_distribution_data(uuid, integer) TO service_role;

GRANT EXECUTE ON FUNCTION public.write_drop_fill(uuid, numeric, text, timestamp with time zone) TO service_role;
GRANT EXECUTE ON FUNCTION public.write_drop_paid(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.write_drop_settled(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.write_new_drop(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.write_reentry_drop(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.write_notification(uuid, text, text, text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.write_profile_update(uuid, boolean, boolean, numeric, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.write_spot(uuid, text, boolean, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.write_spot_stats(uuid, numeric, integer, integer) TO service_role;
