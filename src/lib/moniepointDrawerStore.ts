// Global controller for the MoniepointPaymentDrawer so any component
// can open it via a simple function call, mirroring startMembershipPayment.

import { useEffect, useState } from 'react';
import { clearPayUrlParam } from '@/lib/payUrlSync';

type DrawerState = {
  open: boolean;
  amount: number;
  purpose: 'deposit' | 'membership';
  /** Number of spots to auto-buy after the deposit is credited (deposit only). */
  autoBuySpots?: number;
  /** Exact payout amount already promised upstream for auto-buy deposits. */
  expectedPayout?: number;
  /** When set, drawer rehydrates an existing pending attempt instead of creating a new one. */
  resumeAttemptId?: string;
  onSuccess?: () => void;
  onClose?: () => void;
};

let state: DrawerState = { open: false, amount: 0, purpose: 'deposit', autoBuySpots: 0 };
const listeners = new Set<(s: DrawerState) => void>();

function emit() {
  listeners.forEach((l) => l(state));
}

export function openMoniepointDrawer(opts: {
  amount: number;
  purpose?: 'deposit' | 'membership';
  autoBuySpots?: number;
  expectedPayout?: number;
  resumeAttemptId?: string;
  onSuccess?: () => void;
  onClose?: () => void;
}) {
  state = {
    open: true,
    amount: opts.amount,
    purpose: opts.purpose ?? 'deposit',
    autoBuySpots: opts.autoBuySpots ?? 0,
    expectedPayout: opts.expectedPayout,
    resumeAttemptId: opts.resumeAttemptId,
    onSuccess: opts.onSuccess,
    onClose: opts.onClose,
  };
  emit();
}


export function closeMoniepointDrawer() {
  const onClose = state.onClose;
  // Clear the ?pay=<id> URL param synchronously here so any in-flight
  // initiate-moniepoint-payment response that resolves AFTER close cannot
  // race and re-write it (which would cause the drawer to reappear on the
  // next reload/navigation).
  clearPayUrlParam();
  state = { ...state, open: false, onClose: undefined, resumeAttemptId: undefined, expectedPayout: undefined };
  onClose?.();
  emit();
}

export function useMoniepointDrawerState() {
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
