import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Live queue updates via Supabase Realtime BROADCAST.
 *
 * Why broadcast (not postgres_changes):
 * - Broadcast is a pure pub/sub message — it never touches the database, no WAL,
 *   no per-row triggers, no growing signals table.
 * - Edge functions emit ONE broadcast at the end of each queue mutation
 *   (buy-spot, distribute-liquidity, flutterwave-callback), so a payout that
 *   updates 50 drops still sends a single ping instead of 50.
 * - On the client we additionally debounce invalidations (200ms) so any
 *   rapid burst becomes one refetch.
 */
export const useDropsRealtime = () => {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const scheduleInvalidate = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['drop-status'] });
        queryClient.invalidateQueries({ queryKey: ['balances'] });
      }, 200);
    };

    const channel = supabase
      .channel('public:queue-live') // matches edge function topic + realtime.messages RLS
      .on('broadcast', { event: 'queue_changed' }, () => {
        scheduleInvalidate();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] queue-live broadcast subscribed');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[Realtime] queue-live status:', status);
        }
      });

    channelRef.current = channel;

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [queryClient]);

  return { isSubscribed: !!channelRef.current };
};
