import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  checkInviteKey,
  getInviteParamName,
  getStoredInviteKey,
  saveInviteKey,
} from '@/lib/inviteKey';
import {
  captureExplainerSkipFromUrl,
  getSkipExplainerParamName,
} from '@/lib/explainerSkip';
import { CloakLanding } from '@/pages/Cloak/CloakLanding';

type GateStatus = 'checking' | 'allowed' | 'blocked';

const FALLBACK_MS = 3500;

/**
 * Wraps the entire app. Decides whether to render the real platform
 * (children) or the cloaked landing page.
 *
 * Resolution order:
 *  1. Active Supabase session → allowed (instant).
 *  2. URL ?k=<key> → ALWAYS wins over storage. If valid, persist and strip from URL.
 *  3. Stored key → re-validate quietly.
 *  4. If validation takes > 3.5s with no result → fall back to cloak page so the
 *     user is never stuck on a loading screen. The real app will swap in if
 *     validation eventually succeeds.
 */
export const CloakGate = ({ children }: { children: React.ReactNode }) => {
  const [status, setStatus] = useState<GateStatus>('checking');

  useEffect(() => {
    let cancelled = false;

    // Hard fallback: never let people sit on a spinner.
    const fallback = setTimeout(() => {
      if (!cancelled) {
        setStatus((s) => (s === 'checking' ? 'blocked' : s));
      }
    }, FALLBACK_MS);

    const stripUrlKey = () => {
      const url = new URL(window.location.href);
      const inviteParam = getInviteParamName();
      const skipParam = getSkipExplainerParamName();
      const hadInvite = url.searchParams.has(inviteParam);
      const hadSkip = url.searchParams.has(skipParam);
      if (!hadInvite && !hadSkip) return;
      if (hadInvite) url.searchParams.delete(inviteParam);
      if (hadSkip) url.searchParams.delete(skipParam);
      const clean =
        url.pathname +
        (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '') +
        url.hash;
      window.history.replaceState({}, '', clean);
    };

    const decide = async () => {
      // Capture skip-explainer flag (`?xse=1`) immediately so it survives even
      // if the user is bounced through signup/login before reaching the gate.
      const capturedSkip = captureExplainerSkipFromUrl();

      // Run the session check and the URL/storage key check concurrently.
      const sessionPromise = supabase.auth.getSession().then(({ data }) => data.session);

      const url = new URL(window.location.href);
      const param = getInviteParamName();
      const urlKey = url.searchParams.get(param);

      // URL key wins — overwrite storage immediately so future tabs benefit.
      if (urlKey) {
        saveInviteKey(urlKey);
      }

      const keyToCheck = urlKey || getStoredInviteKey();
      const keyPromise = keyToCheck ? checkInviteKey(keyToCheck) : Promise.resolve(false);

      // Race: whichever resolves first and grants access wins.
      const session = await sessionPromise;
      if (cancelled) return;
      if (session) {
        if (urlKey || capturedSkip) stripUrlKey();
        setStatus('allowed');
        return;
      }

      const keyOk = await keyPromise;
      if (cancelled) return;
      if (keyOk) {
        if (urlKey || capturedSkip) stripUrlKey();
        setStatus('allowed');
        return;
      }

      // Even if blocked, strip the skip param so it doesn't leak into the URL.
      if (capturedSkip) stripUrlKey();
      setStatus('blocked');
    };

    decide();

    // Re-evaluate when the user signs in (e.g. completes signup in the gate).
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session && !cancelled) setStatus('allowed');
    });

    return () => {
      cancelled = true;
      clearTimeout(fallback);
      sub.subscription.unsubscribe();
    };
  }, []);

  if (status === 'checking') {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center gap-4">
        <img src="/logo.png" alt="Viketa" className="h-12 w-12 rounded-xl" />
        <div className="h-6 w-6 rounded-full border-2 border-muted border-t-foreground animate-spin" />
      </div>
    );
  }

  if (status === 'blocked') {
    return <CloakLanding />;
  }

  return <>{children}</>;
};
