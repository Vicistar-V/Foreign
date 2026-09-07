DROP FUNCTION IF EXISTS public.get_unlock_status(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.try_consume_unlock(uuid) CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'unlock_cycles'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.unlock_cycles';
  END IF;
END $$;

DROP TABLE IF EXISTS public.unlock_cycles CASCADE;

ALTER TABLE public.platform_config
  DROP COLUMN IF EXISTS unlock_system_active,
  DROP COLUMN IF EXISTS unlock_invites_required,
  DROP COLUMN IF EXISTS unlock_pending_threshold;