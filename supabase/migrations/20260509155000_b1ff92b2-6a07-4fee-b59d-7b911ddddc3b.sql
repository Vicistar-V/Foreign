-- Remove heavy per-row triggers and the signals table that was streaming WAL events to every browser.
-- We are switching to Supabase Realtime Broadcast (no DB writes, no WAL traffic).

DROP TRIGGER IF EXISTS emit_safe_queue_live_signal_on_drops ON public.drops;
DROP TRIGGER IF EXISTS emit_safe_queue_live_signal_on_spots ON public.spots;
DROP FUNCTION IF EXISTS public.emit_safe_queue_live_signal();

-- Remove from realtime publication if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'live_update_signals'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.live_update_signals;
  END IF;
END $$;

DROP TABLE IF EXISTS public.live_update_signals;