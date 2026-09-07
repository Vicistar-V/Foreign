import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Sends a heartbeat (updates profiles.last_seen_at) via the
 * `record_user_heartbeat` RPC — NO edge function call.
 *
 * Only fires while the tab is actually visible. If the user minimizes
 * the browser or switches tabs, the heartbeat pauses and resumes when
 * they come back.
 */
export const useHeartbeat = (intervalSeconds = 60) => {
  const { user } = useAuth();
  const userId = user?.id;

  const lastHeartbeat = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) return;

    const sendHeartbeat = async () => {
      // Only run when the tab is actually visible
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }

      // Don't count admin dashboard time as "user activity" — admins
      // reviewing accounts should not appear online on their own admin
      // pages, and their heartbeats pollute the last-seen signal.
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
        return;
      }

      // Debounce to once every 30s
      const now = Date.now();
      if (now - lastHeartbeat.current < 30000) return;
      lastHeartbeat.current = now;

      try {
        const { error } = await supabase.rpc('record_user_heartbeat', {
          p_page_path: null,
          p_page_name: null,
          p_action_type: null,
          p_action_detail: null,
          p_session_id: null,
          p_metadata: null,
        });
        if (error) console.warn('[Heartbeat] Error:', error.message);
      } catch (e) {
        console.warn('[Heartbeat] Failed:', e);
      }
    };

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    sendHeartbeat();

    intervalRef.current = window.setInterval(sendHeartbeat, intervalSeconds * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId, intervalSeconds]);
};
