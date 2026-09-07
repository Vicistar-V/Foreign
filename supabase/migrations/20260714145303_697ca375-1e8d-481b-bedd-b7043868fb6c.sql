
DROP FUNCTION IF EXISTS public.record_replay_start CASCADE;
DROP FUNCTION IF EXISTS public.record_replay_chunk CASCADE;
DROP FUNCTION IF EXISTS public.record_replay_heartbeat CASCADE;
DROP FUNCTION IF EXISTS public.record_replay_end CASCADE;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual ILIKE '%session-replays%' OR with_check ILIKE '%session-replays%' OR policyname ILIKE '%replay%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;
