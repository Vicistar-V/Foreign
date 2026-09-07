// Global host for the RestoreCapacityDrawer. Mounted once at app level so
// any spot-buying entry point can trigger the retirement flow via
// `openRestoreCapacityDrawer()` from restoreCapacityStore.

import { useEffect } from 'react';
import { useRetirementStatus } from '@/hooks/useRetirementStatus';
import {
  useRestoreCapacityDrawerState,
  closeRestoreCapacityDrawer,
  openRestoreCapacityDrawer,
} from '@/lib/restoreCapacityStore';
import { RestoreCapacityDrawer } from './RestoreCapacityDrawer';

export function RestoreCapacityHost() {
  const { open, context } = useRestoreCapacityDrawerState();
  const { data: retirement } = useRetirementStatus();

  // Deep link from spot_retired / drop_profit emails: /?restore=1
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('restore') === '1' && retirement?.is_retired) {
      openRestoreCapacityDrawer();
      params.delete('restore');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, [retirement]);

  // If someone tried to open Restore but the user is actually NOT retired
  // (e.g. a stale-cache open from the withdrawal success screen while
  // retirement-status is still refreshing), auto-close the ghost drawer once
  // the fresh data arrives.
  useEffect(() => {
    if (open && retirement && !retirement.is_retired) {
      closeRestoreCapacityDrawer();
    }
  }, [open, retirement]);

  if (!retirement || !retirement.is_retired) return null;

  return (
    <RestoreCapacityDrawer
      open={open}
      onOpenChange={(o) => {
        if (!o) closeRestoreCapacityDrawer();
      }}
      status={retirement}
      pendingBalance={context.pendingBalance}
    />
  );
}

