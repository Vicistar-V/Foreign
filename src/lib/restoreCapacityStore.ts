// Global controller for the RestoreCapacityDrawer so any entry point that
// tries to open a spot-buying UI can intercept and route the user through
// the 1-click Restore flow when they are retired (0 active spots after a payout).

import { useEffect, useState } from 'react';

// Optional context threaded from the caller — e.g. PendingCycleExplainer
// passes the user's pending balance so the drawer summary can surface
// "restoring releases your ₦X pending" framing exactly when the user needs
// it to justify paying restore fees. (P1-6)
type OpenContext = { pendingBalance?: number };
type State = { open: boolean; context: OpenContext };

let state: State = { open: false, context: {} };
const listeners = new Set<(s: State) => void>();

function emit() {
  listeners.forEach((l) => l(state));
}

let lastOpenedAt = 0;

export function openRestoreCapacityDrawer(context: OpenContext = {}) {
  state = { open: true, context };
  lastOpenedAt = Date.now();
  emit();
}

export function closeRestoreCapacityDrawer() {
  state = { open: false, context: {} };
  emit();
}


/**
 * Returns milliseconds since the Restore drawer was last opened, or Infinity
 * if it has never been opened this session. Used to suppress duplicate
 * "restore your spots" nudges when the user is already actively looking at
 * the drawer or just closed it seconds ago.
 */
export function msSinceRestoreDrawerOpened() {
  return lastOpenedAt === 0 ? Infinity : Date.now() - lastOpenedAt;
}


export function useRestoreCapacityDrawerState() {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    setS(state);
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}

// ── Module-level "am I retired?" flag ────────────────────────────────────
// Updated by useRetirementStatus whenever it receives fresh data, so
// non-React callers (startExtensionPayment, etc.) can intercept spot-buying
// flows synchronously.
let cachedIsRetired = false;
export function setCachedIsRetired(v: boolean) {
  cachedIsRetired = v;
}
export function getCachedIsRetired() {
  return cachedIsRetired;
}

/**
 * Central interceptor: any UI that wants to open a spot-buying flow should
 * call this first. Returns true if the retirement drawer was opened instead
 * (caller should abort its own flow).
 */
export function interceptForRestoreIfRetired(): boolean {
  if (cachedIsRetired) {
    openRestoreCapacityDrawer();
    return true;
  }
  return false;
}
