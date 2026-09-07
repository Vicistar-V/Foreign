import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { openMoniepointDrawer } from '@/lib/moniepointDrawerStore';
import { interceptForRestoreIfRetired } from '@/lib/restoreCapacityStore';
import { trackLogRocketEvent, LREvents } from '@/lib/logrocket';

/**
 * Buy an extra ad share (payout-capacity extension).
 *
 * FLAT PRICING: every ad share costs the same price as the first one
 * (`platform_config.drop_entry_fee`, kept equal to `membership_fee`).
 * There are no discounted "extra" shares. Each share adds ₦10,000 to the
 * user's payout target.
 *
 * Under the hood we take a deposit for exactly that price and let the shared
 * `runAutoBuySpots` pipeline call `buy-spot` for us. `buy-spot` charges
 * `platform_config.drop_entry_fee` against the deposit wallet and splits it
 * exactly as the spec requires — so we get the split for free without a
 * new edge function.
 */

let inFlight = false;
const listeners = new Set<(v: boolean) => void>();

function setInFlight(v: boolean) {
  inFlight = v;
  listeners.forEach((l) => l(v));
}

export function useExtensionPaymentLoading() {
  const [loading, setLoading] = useState(inFlight);
  useEffect(() => {
    listeners.add(setLoading);
    setLoading(inFlight);
    return () => {
      listeners.delete(setLoading);
    };
  }, []);
  return loading;
}

type StartExtensionPaymentOptions = {
  quantity?: number;
  onBeforeMoniepointOpen?: () => void;
  onMoniepointClose?: () => void;
  onMoniepointSuccess?: () => void;
};

export async function startExtensionPayment(
  amount: number,
  options: StartExtensionPaymentOptions = {},
) {
  if (inFlight) return;
  // 🔁 Retirement interceptor: if all this user's spots have retired,
  // route them through the 1-click Restore Capacity flow instead of
  // charging them for a single extension spot.
  if (interceptForRestoreIfRetired()) return;
  if (!amount || amount < 50) {
    toast({ title: 'Invalid amount', variant: 'destructive' });
    return;
  }
  setInFlight(true);

  try {
    trackLogRocketEvent(LREvents.ACTIVATION_PAYMENT_STARTED, {
      amount,
      purpose: 'extension_spot',
    });

    const { data, error } = await supabase.functions.invoke('start-payment', {
      body: { amount, metadata: { purpose: 'extension_spot' } },
    });

    if (error || data?.error) {
      toast({
        title: 'Payment Error',
        description:
          error?.message || data?.details || data?.error || 'Failed to start payment',
        variant: 'destructive',
      });
      setInFlight(false);
      return;
    }

    if (data?.provider === 'moniepoint') {
      options.onBeforeMoniepointOpen?.();
      openMoniepointDrawer({
        amount,
        purpose: 'deposit',
        autoBuySpots: options.quantity ?? 1,
        onClose: options.onMoniepointClose,
        onSuccess: options.onMoniepointSuccess,
      });
      setInFlight(false);
      return;
    }

    if (data?.paymentLink) {
      window.location.href = data.paymentLink;
      return;
    }

    toast({
      title: 'Payment Error',
      description: 'No payment link received',
      variant: 'destructive',
    });
    setInFlight(false);
  } catch (e: any) {
    toast({
      title: 'Payment Failed',
      description: e?.message || 'Please try again',
      variant: 'destructive',
    });
    setInFlight(false);
  }
}
