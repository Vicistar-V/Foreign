// ---------------------------------------------------------------------------
// LogRocket integration.
//
// Why we initialise here and not directly in `main.tsx`:
//   - We want a single safe entry point that's a no-op in dev / preview so
//     local sessions don't pollute production replays.
//   - We expose `identifyLogRocketUser` and `trackLogRocketEvent` so the rest
//     of the app can attribute every replay to a real user (email / name /
//     activation state) and tag conversion milestones (signup, viewed
//     activation, started payment, became member, first withdrawal, ...).
//
// The LogRocket app id below is the production project the user provided.
// ---------------------------------------------------------------------------
import LogRocket from 'logrocket';
import setupLogRocketReact from 'logrocket-react';

const APP_ID = 'g5qjwe/viketa';

// Hostnames that should NOT record to LogRocket. We only want real user
// sessions from the live app — not lovable preview iframes or localhost dev.
const EXCLUDED_HOST_PATTERNS = [
  'localhost',
  '127.0.0.1',
  'lovable.app',     // covers lovable preview + sandbox
  'lovableproject.com',
];

let initialised = false;
let identified = false;

function shouldEnable(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return !EXCLUDED_HOST_PATTERNS.some((p) => host.includes(p));
}

export function initLogRocket() {
  if (initialised) return;
  if (!shouldEnable()) {
    // Stay silent in dev/preview, but flag it so the rest of the app's
    // identify/track helpers know to no-op cleanly.
    initialised = true;
    return;
  }
  try {
    LogRocket.init(APP_ID, {
      // Capture network bodies so we can see API failures in replays, but
      // strip auth headers so tokens never leak into recordings.
      network: {
        requestSanitizer: (request) => {
          if (request.headers && request.headers['Authorization']) {
            request.headers['Authorization'] = '';
          }
          if (request.headers && request.headers['authorization']) {
            request.headers['authorization'] = '';
          }
          // Never record password / pin payloads
          const body = (request.body || '').toString();
          if (/password|pin|access_token|refresh_token/i.test(body)) {
            request.body = '[REDACTED]';
          }
          return request;
        },
        responseSanitizer: (response) => {
          const body = (response.body || '').toString();
          if (/access_token|refresh_token|password/i.test(body)) {
            response.body = '[REDACTED]';
          }
          return response;
        },
      },
    });
    (setupLogRocketReact as unknown as (lr: typeof LogRocket) => void)(LogRocket);
    initialised = true;
  } catch (e) {
    // Never break the app because of analytics.
    console.warn('[LogRocket] init failed', e);
    initialised = true;
  }
}

type IdentifyTraits = {
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  isMember?: boolean | null;
  isBanned?: boolean | null;
  referralCode?: string | null;
  createdAt?: string | null;
  hasPin?: boolean | null;
  hasSeenExplainer?: boolean | null;
};

/**
 * Attach the authenticated user's identity to the active LogRocket session.
 * Safe to call repeatedly — LogRocket dedups on userId+traits.
 */
export function identifyLogRocketUser(userId: string, traits: IdentifyTraits = {}) {
  if (!initialised || !shouldEnable() || !userId) return;
  try {
    const cleanTraits: Record<string, string | number | boolean> = {};
    if (traits.email) cleanTraits.email = traits.email;
    if (traits.name) cleanTraits.name = traits.name;
    if (traits.phone) cleanTraits.phone = traits.phone;
    if (typeof traits.isMember === 'boolean') {
      cleanTraits.isMember = traits.isMember;
      cleanTraits.activationStatus = traits.isMember ? 'activated' : 'not_activated';
    }
    if (typeof traits.isBanned === 'boolean') cleanTraits.isBanned = traits.isBanned;
    if (traits.referralCode) cleanTraits.referralCode = traits.referralCode;
    if (traits.createdAt) cleanTraits.createdAt = traits.createdAt;
    if (typeof traits.hasPin === 'boolean') cleanTraits.hasPin = traits.hasPin;
    if (typeof traits.hasSeenExplainer === 'boolean') {
      cleanTraits.hasSeenExplainer = traits.hasSeenExplainer;
    }
    LogRocket.identify(userId, cleanTraits);
    identified = true;
  } catch (e) {
    console.warn('[LogRocket] identify failed', e);
  }
}

/**
 * Track a named conversion / funnel event in LogRocket.
 * Use UPPER_SNAKE_CASE names so they group nicely in the dashboard.
 */
export function trackLogRocketEvent(
  name: string,
  props: Record<string, string | number | boolean> = {},
) {
  if (!initialised || !shouldEnable()) return;
  try {
    LogRocket.track(name, props);
  } catch (e) {
    console.warn('[LogRocket] track failed', e);
  }
}

/**
 * Returns the deep-link URL of the current session in LogRocket. Handy if we
 * later want to surface "watch this user's session" buttons in admin tools.
 */
export function getLogRocketSessionURL(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!initialised || !shouldEnable()) return resolve(null);
    try {
      LogRocket.getSessionURL((url) => resolve(url));
    } catch {
      resolve(null);
    }
  });
}

export function isLogRocketIdentified() {
  return identified;
}

/**
 * Build a deep link into the LogRocket dashboard that filters sessions to a
 * single user by their Supabase user id (which we pass to LogRocket.identify
 * as the canonical user id). Used by admin tools to jump straight from a
 * user details page to that user's replays.
 */
export function buildLogRocketUserURL(userId: string): string {
  const filters = [
    {
      type: 'userID',
      operator: { name: 'is', type: 'IS' },
      value: userId,
      field: 'userID',
    },
  ];
  const encoded = encodeURIComponent(JSON.stringify(filters));
  return `https://app.logrocket.com/${APP_ID}/sessions?filters=${encoded}`;
}

// Common conversion event names — keep in one place so the funnel is
// consistent across the app.
export const LREvents = {
  SIGNUP_STARTED: 'SIGNUP_STARTED',
  SIGNUP_COMPLETED: 'SIGNUP_COMPLETED',
  LOGIN_COMPLETED: 'LOGIN_COMPLETED',
  VIEWED_DASHBOARD_AS_GUEST: 'VIEWED_DASHBOARD_NON_MEMBER',
  ACTIVATION_DRAWER_OPENED: 'ACTIVATION_DRAWER_OPENED',
  ACTIVATION_PAYMENT_STARTED: 'ACTIVATION_PAYMENT_STARTED',
  ACTIVATION_PAYMENT_REDIRECTED: 'ACTIVATION_PAYMENT_REDIRECTED',
  ACTIVATION_PAYMENT_FAILED: 'ACTIVATION_PAYMENT_FAILED',
  BECAME_MEMBER: 'BECAME_MEMBER',
  FIRST_WITHDRAWAL_SUBMITTED: 'FIRST_WITHDRAWAL_SUBMITTED',
} as const;
