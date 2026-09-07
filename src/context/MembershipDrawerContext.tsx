import { createContext, useContext, ReactNode, useCallback, useState } from 'react';
import { triggerHaptic } from '@/lib/haptics';
import { MoniepointDrawerHost } from '@/components/MoniepointDrawerHost';
import { SpotQuantityDrawer } from '@/components/SpotQuantityDrawer';

import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';
import { logUserActivity } from '@/lib/userActivityLogger';
import { trackLogRocketEvent, LREvents } from '@/lib/logrocket';

interface MembershipDrawerContextValue {
  /**
   * Opens the "How many ad shares can you afford?" drawer. User picks quantity,
   * sees payout grow in real-time, and then confirms — which routes into the
   * shared payment flow with the right amount + autoBuySpots.
   */
  openMembershipDrawer: () => void;
}

const MembershipDrawerContext = createContext<MembershipDrawerContextValue | null>(null);

export const useMembershipDrawer = (): MembershipDrawerContextValue => {
  const ctx = useContext(MembershipDrawerContext);
  if (!ctx) {
    if (typeof console !== 'undefined') {
      console.warn('[MembershipDrawer] useMembershipDrawer called outside provider');
    }
    return { openMembershipDrawer: () => {} };
  }
  return ctx;
};

export const MembershipDrawerProvider = ({ children }: { children: ReactNode }) => {
  const [qtyOpen, setQtyOpen] = useState(false);

  const openMembershipDrawer = useCallback(() => {
    triggerHaptic('heavy');
    trackClarityEvent(ClarityEvents.ACTIVATION_DRAWER_OPENED);
    trackLogRocketEvent(LREvents.ACTIVATION_DRAWER_OPENED);
    logUserActivity('activation_qty_drawer_opened', 'dialog_open', {});
    setQtyOpen(true);
  }, []);

  return (
    <MembershipDrawerContext.Provider value={{ openMembershipDrawer }}>
      {children}
      <SpotQuantityDrawer open={qtyOpen} onOpenChange={setQtyOpen} />
      <MoniepointDrawerHost />
    </MembershipDrawerContext.Provider>
  );
};
