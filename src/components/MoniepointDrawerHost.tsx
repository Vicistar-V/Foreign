// Host component that renders the global MoniepointPaymentDrawer.
// Mounted once near the app root (inside MembershipDrawerProvider).

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
  const { open, amount, purpose, autoBuySpots, expectedPayout, resumeAttemptId, onSuccess } = useMoniepointDrawerState();
  const { user, loading } = useAuth();

  // Capture the ?pay=<id> param ONCE on first mount, before anything else
  // has a chance to touch the URL. We then wait for auth before opening.
  const pendingResumeIdRef = useRef<string | null>(null);
  const consumedRef = useRef(false);
  if (pendingResumeIdRef.current === null && !consumedRef.current) {
    pendingResumeIdRef.current = readPayUrlParam();
  }

  useEffect(() => {
    if (loading) return;
    if (!user?.id) return;
    if (open || consumedRef.current) return;
    const attemptId = pendingResumeIdRef.current;
    if (!attemptId) return;
    consumedRef.current = true;
    openMoniepointDrawer({
      amount: 0,
      purpose: 'deposit',
      resumeAttemptId: attemptId,
    });
  }, [user?.id, loading, open]);


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
