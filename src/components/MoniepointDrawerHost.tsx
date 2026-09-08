// Host component that renders the global MoniepointPaymentDrawer.
// Mounted once near the app root. Supports both members and anonymous ad visitors.

import { useEffect, useRef } from 'react';
import { MoniepointPaymentDrawer } from '@/components/MoniepointPaymentDrawer';
import {
  closeMoniepointDrawer,
  openMoniepointDrawer,
  useMoniepointDrawerState,
} from '@/lib/moniepointDrawerStore';
import { readPayUrlParam } from '@/lib/payUrlSync';
import { useAuth } from '@/hooks/useAuth';

export const MoniepointDrawerHost = () => {
  const { open, amount, purpose, autoBuySpots, expectedPayout, resumeAttemptId, onSuccess } =
    useMoniepointDrawerState();
  const { loading } = useAuth();

  // Capture the ?pay=<id> param ONCE on first mount before URL is cleaned
  const pendingResumeIdRef = useRef<string | null>(null);
  const consumedRef = useRef(false);

  if (pendingResumeIdRef.current === null && !consumedRef.current) {
    pendingResumeIdRef.current = readPayUrlParam();
  }

  useEffect(() => {
    // Wait until auth state resolves
    if (loading) return;
    if (open || consumedRef.current) return;

    const attemptId = pendingResumeIdRef.current;
    if (!attemptId) return;

    // Mark consumed so it only rehydrates once
    consumedRef.current = true;

    // Resumes the drawer for BOTH guests and signed-in members
    openMoniepointDrawer({
      amount: 1000,
      purpose: 'membership',
      resumeAttemptId: attemptId,
    });
  }, [loading, open]);

  return (
    <MoniepointPaymentDrawer
      open={open}
      onOpenChange={(o) => {
        if (!o) closeMoniepointDrawer();
      }}
      amount={amount}
      purpose={purpose}
      autoBuySpots={autoBuySpots}
      expectedPayout={expectedPayout}
      resumeAttemptId={resumeAttemptId}
      onSuccess={onSuccess}
    />
  );
};
