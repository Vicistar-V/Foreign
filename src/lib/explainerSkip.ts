/**
 * Skip Explainer URL flag.
 *
 * The explainer video is shown ONCE, and only BEFORE sign-up (/watch-first).
 * There is no video step after sign-up any more.
 *
 * Flow:
 *  1. Ad traffic lands with `?xse=1` (their advert page already showed the
 *     video). CloakGate captures it, stores the flag, strips the param.
 *  2. The sign-up page sends anyone WITHOUT that flag (and who hasn't
 *     already watched on this device) to /watch-first, where they must
 *     watch 90% before continuing.
 *  3. Finishing /watch-first stores the same flag plus a permanent
 *     "watched before signup" marker.
 *  4. After sign-up, ProtectedRoute simply records `has_seen_explainer` in
 *     the background — it never redirects anyone to a video.
 */


const SKIP_PARAM = 'xse';
const STORAGE_KEY = 'viketa_skip_explainer';
// Set once the visitor has watched the video BEFORE signing up. This one is
// never cleared, so a person who already watched it never sees it again on
// this device — even after the one-time `viketa_skip_explainer` flag has been
// consumed and cleared by ProtectedRoute.
const WATCHED_BEFORE_SIGNUP_KEY = 'viketa_watched_before_signup';

export const getSkipExplainerParamName = () => SKIP_PARAM;

/**
 * Marks the explainer as "already watched" for this device. Used by the
 * pre-signup explainer screen so the post-signup gate auto-skips.
 */
export const storeExplainerSkip = () => {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* noop */
  }
};

export const markWatchedBeforeSignup = () => {
  try {
    localStorage.setItem(WATCHED_BEFORE_SIGNUP_KEY, String(Date.now()));
  } catch {
    /* noop */
  }
};

export const hasWatchedBeforeSignup = (): boolean => {
  try {
    return !!localStorage.getItem(WATCHED_BEFORE_SIGNUP_KEY);
  } catch {
    return false;
  }
};

export const captureExplainerSkipFromUrl = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get(SKIP_PARAM);
    if (raw && raw !== '0' && raw.toLowerCase() !== 'false') {
      localStorage.setItem(STORAGE_KEY, '1');
      return true;
    }
  } catch {
    /* noop */
  }
  return false;
};

export const hasStoredExplainerSkip = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

export const clearStoredExplainerSkip = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
};
