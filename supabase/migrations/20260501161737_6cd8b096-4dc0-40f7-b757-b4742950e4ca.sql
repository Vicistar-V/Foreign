-- Drop the last orphan calibration-era RPC; nothing references it.
DROP FUNCTION IF EXISTS public.pay_genesis_yield(uuid, uuid, numeric, boolean) CASCADE;