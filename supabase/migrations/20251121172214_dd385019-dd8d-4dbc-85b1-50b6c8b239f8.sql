-- Drop the old verify_pin database function (replaced by verify-pin edge function)
DROP FUNCTION IF EXISTS public.verify_pin(uuid, text);