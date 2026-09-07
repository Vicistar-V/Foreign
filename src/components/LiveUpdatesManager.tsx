import { useEffect, useRef, useState, createContext, useContext } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface LiveUpdatesContextType {
  isConnected: boolean;
  lastUpdateAt: Date | null;
}

const LiveUpdatesContext = createContext<LiveUpdatesContextType>({
  isConnected: false,
  lastUpdateAt: null,
});

export const useLiveUpdates = () => useContext(LiveUpdatesContext);

/**
 * Global real-time updates manager.
 * Mounts ONCE in AppLayout to avoid duplicate subscriptions.
 * Uses refetchQueries for instant UI updates.
 */
export function LiveUpdatesManager({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdateAt, setLastUpdateAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setIsConnected(false);
      return;
    }

    const refreshNow = (keys: unknown[][]) => {
      setLastUpdateAt(new Date());
      keys.forEach((queryKey) => {
        queryClient.refetchQueries({ queryKey, type: 'active' });
        queryClient.invalidateQueries({ queryKey });
      });
    };

    const refreshSoon = (keys: unknown[][], delay = 350) => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        refreshNow(keys);
      }, delay);
    };

    console.log('[LiveUpdates] Initializing secure live updates...');

    // Private channel name is scoped to the signed-in user by realtime.messages RLS.
    const channel = supabase
      .channel(`user:${user.id}:app-live`)
      // Safe queue signal: contains only event type metadata, never private rows.
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_update_signals',
          filter: 'signal_type=eq.queue_changed',
        },
        (payload) => {
          console.log('[LiveUpdates] Queue signal:', payload.eventType);
          refreshSoon([['drop-status'], ['earnings-timeline']]);
        }
      )
      // Listen to this user's spot rows only.
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'spots',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[LiveUpdates] My spots change:', payload.eventType);
          refreshSoon([['drop-status']]);
        }
      )
      // Listen to transactions for wallet updates
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[LiveUpdates] Transaction change:', payload.eventType);
          refreshSoon([['balances'], ['transactions'], ['drop-status']], 150);
        }
      )
      // Listen to cached wallet balance changes for this user
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cached_balances',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[LiveUpdates] Balance change:', payload.eventType);
          refreshSoon([['balances']], 150);
        }
      )
      // Listen to notifications
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[LiveUpdates] Notification change:', payload.eventType);
          refreshSoon([['notifications']], 150);
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[LiveUpdates] Global channel connected');
          setIsConnected(true);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[LiveUpdates] Channel error:', err);
          setIsConnected(false);
        } else if (status === 'CLOSED') {
          console.log('[LiveUpdates] Channel closed');
          setIsConnected(false);
        } else {
          console.log('[LiveUpdates] 📡 Status:', status);
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      console.log('[LiveUpdates] Cleaning up global channel...');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [queryClient, user?.id]);

  return (
    <LiveUpdatesContext.Provider value={{ isConnected, lastUpdateAt }}>
      {children}
    </LiveUpdatesContext.Provider>
  );
}
