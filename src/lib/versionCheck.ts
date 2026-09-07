/**
 * Version Check — detects when a new build has been deployed and prompts
 * the user to soft-reload so they pick up the new UI without needing a
 * manual hard refresh.
 *
 * How it works:
 *   1. On boot we capture the hash of the main script tag in the current
 *      index.html (e.g. /assets/index-ABC123.js → "ABC123"). That is the
 *      "build fingerprint" of whatever the user is currently running.
 *   2. Every 60s while the tab is visible, and whenever the tab regains
 *      focus / comes back online, we fetch a fresh copy of "/" with
 *      cache-busting, parse its main script hash, and compare.
 *   3. If the hash changed we show a sticky toast: "A new version is
 *      available — Tap to refresh". Tapping does a soft window.location
 *      reload (no caches.clear needed; sw is already a kill-switch).
 *
 * Why a runtime check on top of cache headers:
 *   Even with correct Cache-Control headers, a user can keep a tab open
 *   for hours/days. They'd never see new deploys until they navigate or
 *   refresh. This check makes long-lived tabs self-update.
 */

import { toast } from 'sonner';

const POLL_INTERVAL_MS = 60_000; // 1 minute
const ENDPOINT = '/'; // SPA entry — always returns index.html

let bootHash: string | null = null;
let promptShown = false;
let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Extract a fingerprint from index.html. We look for the main script tag
 * (Vite always injects exactly one type="module" src="/assets/index-*.js")
 * and return its src. If anything goes wrong we return null and skip the
 * check — better to do nothing than to spam a refresh prompt.
 */
function extractFingerprint(html: string): string | null {
  try {
    // Match: <script type="module" crossorigin src="/assets/index-XXXX.js">
    // Vite output is stable, but we keep the regex permissive.
    const match = html.match(/<script[^>]+src="(\/assets\/[^"]+\.js)"/i);
    if (match && match[1]) return match[1];

    // Fallback: any /assets/*.js src in head
    const anyAsset = html.match(/src="(\/assets\/[A-Za-z0-9_-]+\.js)"/i);
    return anyAsset ? anyAsset[1] : null;
  } catch {
    return null;
  }
}

/**
 * Read the fingerprint of the build the user is CURRENTLY running by
 * inspecting the live DOM. We do this once at startup.
 */
function readCurrentFingerprint(): string | null {
  try {
    const scripts = Array.from(
      document.querySelectorAll('script[type="module"][src*="/assets/"]')
    ) as HTMLScriptElement[];
    if (scripts.length === 0) return null;
    // Prefer the entry chunk (contains "index-" in Vite default config).
    const entry = scripts.find((s) => /\/assets\/index-/i.test(s.src)) ?? scripts[0];
    // Normalize: strip origin, keep pathname only.
    try {
      const u = new URL(entry.src, window.location.origin);
      return u.pathname;
    } catch {
      return entry.src;
    }
  } catch {
    return null;
  }
}

async function fetchLatestFingerprint(): Promise<string | null> {
  try {
    // Cache-bust aggressively — we want the truly latest HTML from origin.
    const res = await fetch(`${ENDPOINT}?_v=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    });
    if (!res.ok) return null;
    const html = await res.text();
    return extractFingerprint(html);
  } catch {
    return null;
  }
}

function showUpdatePrompt() {
  if (promptShown) return;
  promptShown = true;

  // Sticky toast — user must tap to dismiss / refresh.
  toast('A new version is available', {
    description: 'Tap refresh to get the latest features.',
    duration: Infinity,
    action: {
      label: 'Refresh',
      onClick: () => {
        // Soft reload. The kill-switch sw.js + no-cache headers ensure
        // the next load pulls fresh HTML + chunks.
        window.location.reload();
      },
    },
  });
}

async function checkNow() {
  if (!bootHash || promptShown) return;
  if (document.visibilityState === 'hidden') return;
  if (!navigator.onLine) return;

  const latest = await fetchLatestFingerprint();
  if (!latest) return;

  if (latest !== bootHash) {
    if (import.meta.env.DEV) {
      console.log('[version-check] new build detected', { bootHash, latest });
    }
    showUpdatePrompt();
    stop(); // No need to keep polling after we prompted.
  }
}

function start() {
  if (timer) return;
  timer = setInterval(checkNow, POLL_INTERVAL_MS);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function initVersionCheck() {
  // Skip in dev / preview — only meaningful in production where the user
  // is on a deployed build that can become stale.
  if (import.meta.env.DEV) return;
  const host = window.location.hostname.toLowerCase();
  if (host === 'localhost' || host.includes('lovable')) return;

  bootHash = readCurrentFingerprint();
  if (!bootHash) return; // Can't fingerprint → nothing to compare against.

  start();

  // Re-check immediately when the user comes back to the tab — that's the
  // single most common moment where a stale build is noticed.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkNow();
  });
  window.addEventListener('focus', checkNow);
  window.addEventListener('online', checkNow);
}
