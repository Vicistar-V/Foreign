-- Rollback: Remove the pin_secret column since we're using edge function instead
ALTER TABLE public.platform_config DROP COLUMN IF EXISTS pin_secret;