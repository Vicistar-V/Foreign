import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { getSessionId } from '@/lib/sessionId';
import { getPageName, getBasePath } from '@/lib/pageNameMapping';

/**
 * Hook that tracks user journey through the app.
 * Automatically logs page views and provides a function to log custom actions.
 * 
 * Features:
 * - Automatic page view tracking on navigation
 * - Time spent on page tracking
 * - Custom action tracking (button clicks, etc.)
 * - Session-based grouping of activities
 * - Debouncing to prevent duplicate logs
 */
export const useJourneyTracker = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const location = useLocation();
  
  const lastTrackedPath = useRef<string>('');
  const pageEntryTime = useRef<number>(Date.now());
  const isTracking = useRef<boolean>(false);

  /**
   * Sends activity data to the backend
   */
  const logActivity = useCallback(async (
    actionType: string,
    actionDetail?: string,
    extraMetadata?: Record<string, unknown>
  ) => {
    if (!userId) return;

    // Skip while the tab is hidden / browser minimized
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }

    // Never track admin routes — admin activity is not user activity.
    if (location.pathname.startsWith('/admin')) {
      return;
    }

    const currentPath = getBasePath(location.pathname);
    const pageName = getPageName(currentPath);
    const sessionId = getSessionId();

    const timeOnPage = actionType === 'page_view'
      ? Math.round((Date.now() - pageEntryTime.current) / 1000)
      : undefined;

    try {
      const { error } = await supabase.rpc('record_user_heartbeat', {
        p_page_path: currentPath,
        p_page_name: pageName,
        p_action_type: actionType,
        p_action_detail: actionDetail || null,
        p_session_id: sessionId,
        p_metadata: {
          screen_width: window.innerWidth,
          screen_height: window.innerHeight,
          time_on_previous_page: timeOnPage,
          referrer: document.referrer || null,
          ...extraMetadata,
        },
      });

      if (error) {
        console.log('[Journey] RPC error:', error.message);
      } else {
        console.log(`[Journey] Logged: ${actionType} on ${pageName}`);
      }
    } catch (error) {
      console.log('[Journey] Failed to log activity:', error);
    }
  }, [userId, location.pathname]);

  /**
   * Track page views automatically when location changes
   */
  useEffect(() => {
    if (!userId) return;
    
    const currentPath = getBasePath(location.pathname);
    
    // Don't track if we're already on this page (handles StrictMode double-mount
    // and intentional re-renders without re-logging the same view).
    if (currentPath === lastTrackedPath.current) {
      return;
    }

    // Log the page view immediately — no debounce lock, otherwise rapid
    // redirects in onboarding (e.g. /dashboard → /watch-explainer) silently
    // drop the second view and the funnel data becomes useless.
    logActivity('page_view');

    // Update tracking state
    lastTrackedPath.current = currentPath;
    pageEntryTime.current = Date.now();
  }, [userId, location.pathname, logActivity]);

  /**
   * Track when user leaves the page (for accurate time-on-page)
   */
  useEffect(() => {
    if (!userId) return;

    const handleBeforeUnload = () => {
      const timeOnPage = Math.round((Date.now() - pageEntryTime.current) / 1000);
      
      // Use sendBeacon for reliable tracking on page unload
      const sessionId = getSessionId();
      const currentPath = getBasePath(location.pathname);
      const pageName = getPageName(currentPath);
      
      // Note: sendBeacon doesn't work with auth headers, so this is best-effort
      // The actual time tracking happens on the next page_view event
      console.log(`[Journey] User leaving ${pageName} after ${timeOnPage}s`);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [userId, location.pathname]);

  /**
   * Public function to track custom actions (button clicks, etc.)
   */
  const trackAction = useCallback((
    actionDetail: string,
    actionType: string = 'button_click',
    metadata?: Record<string, unknown>
  ) => {
    logActivity(actionType, actionDetail, metadata);
  }, [logActivity]);

  return { trackAction };
};
