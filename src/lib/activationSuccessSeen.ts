// Per-device localStorage flag: has this user seen the /activation-success
// celebration/upsell screen after joining The Viketa Line?
// Kept in its own module so both the page and ProtectedRoute can import it
// without pulling in the legacy modal component.

// Bumped to v2 so users who already have the old flag from previous
// releases (before we finalised the celebration UX) will see the screen
// again on their next authenticated load.
const KEY = 'viketa_activation_success_seen_v2';

export const hasSeenActivationSuccess = (): boolean => {
  try {
    return localStorage.getItem(KEY) === 'true';
  } catch {
    return true; // fail-open: if storage is blocked, don't trap the user
  }
};

export const markActivationSuccessSeen = (): void => {
  try {
    localStorage.setItem(KEY, 'true');
  } catch {}
};

export const resetActivationSuccessSeen = (): void => {
  try {
    localStorage.removeItem(KEY);
  } catch {}
};
