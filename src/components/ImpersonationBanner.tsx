import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { LogOut, Eye, Loader2 } from 'lucide-react';
import { queryClient } from '@/App';

const FLAG_KEY = 'impersonation_active';

/**
 * Banner shown in the impersonation tab.
 *
 * Detection: when an admin starts impersonation, the edge function appends
 * `?impersonated=1` to the magic-link redirect. On first load we move that
 * flag into sessionStorage (so the banner persists for that tab only as the
 * user navigates) and strip the query param from the URL.
 *
 * Ending: signOut() clears the target user's session and returns the tab to
 * /login. The admin's original tab is untouched (separate browser session).
 */
export const ImpersonationBanner = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const [active, setActive] = useState(false);
  const [ending, setEnding] = useState(false);

  // Capture the ?impersonated=1 flag once, then strip it from the URL.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('impersonated') === '1') {
      try {
        sessionStorage.setItem(FLAG_KEY, '1');
      } catch (_) { /* ignore */ }
      params.delete('impersonated');
      const qs = params.toString();
      const cleanUrl =
        window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
      window.history.replaceState({}, '', cleanUrl);
    }
    try {
      setActive(sessionStorage.getItem(FLAG_KEY) === '1');
    } catch (_) {
      setActive(false);
    }
  }, [location.pathname]);

  const handleEnd = async () => {
    setEnding(true);
    try {
      try { sessionStorage.removeItem(FLAG_KEY); } catch (_) { /* ignore */ }
      try { queryClient.clear(); } catch (_) { /* ignore */ }
      await supabase.auth.signOut();
    } finally {
      // Try to close the impersonation tab; if blocked, send to /login.
      try {
        window.close();
      } catch (_) { /* ignore */ }
      // window.close() only works for tabs opened by script; fall back to redirect.
      setTimeout(() => {
        navigate('/login', { replace: true });
        setEnding(false);
      }, 200);
    }
  };

  if (!active || !user) return null;

  const name = profile?.full_name || user.email || 'user';

  return (
    <div className="fixed top-0 inset-x-0 z-[100] bg-amber-500 text-amber-950 shadow-lg">
      <div className="max-w-5xl mx-auto px-3 py-2 flex items-center gap-2">
        <Eye className="h-4 w-4 shrink-0" />
        <div className="text-xs sm:text-sm font-medium truncate flex-1">
          <span className="hidden sm:inline">Admin view — </span>
          You are signed in as <span className="font-bold">{name}</span>
        </div>
        <button
          type="button"
          onClick={handleEnd}
          disabled={ending}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-amber-950 text-amber-50 px-3 py-1.5 text-xs font-semibold hover:bg-amber-900 disabled:opacity-60"
        >
          {ending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LogOut className="h-3.5 w-3.5" />
          )}
          End session
        </button>
      </div>
    </div>
  );
};
