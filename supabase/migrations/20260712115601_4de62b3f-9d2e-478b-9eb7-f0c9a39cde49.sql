-- Remove legacy Retirement-Economy-incompatible liquidity distributor and its orphaned wrappers.
-- The active path is the edge function supabase/functions/distribute-liquidity (called by buy-spot).
-- None of these are referenced by any function, trigger, cron job, edge function, or frontend code.
DROP FUNCTION IF EXISTS public.process_single_reentry(uuid, uuid, uuid, text, integer, numeric);
DROP FUNCTION IF EXISTS public.call_distribute_liquidity_edge(uuid, numeric, integer);
DROP FUNCTION IF EXISTS public.distribute_liquidity(uuid, numeric, integer);