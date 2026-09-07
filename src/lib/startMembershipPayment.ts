import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';
import { trackFBInitiateCheckout } from '@/lib/facebookPixel';
import { openMoniepointDrawer } from '@/lib/moniepointDrawerStore';
import { trackLogRocketEvent, LREvents } from '@/lib/logrocket';

let inFlight = false;
const listeners = new Set<(v: boolean) => void>();

function setInFlight(v: boolean) {
  inFlight = v;
  listeners.forEach((l) => l(v));
}

/**
 * Subscribe in React components to show a loading state on any
 * "become a member" button while the payment is being prepared.
 */
export function useMembershipPaymentLoading() {
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

/**
 * Begin the membership payment flow.
 *
 * Routes based on the platform's `payment_provider` config:
 *   - `moniepoint` (default): opens the in-app bank-transfer drawer.
 *   - `flutterwave`: redirects to the Flutterwave-hosted payment page.
 */
type StartMembershipPaymentOptions = {
  onBeforeMoniepointOpen?: () => void;
  onMoniepointClose?: () => void;
  onMoniepointSuccess?: () => void;
  /** Extra spots to auto-buy on top of the activation spot. */
  autoBuySpots?: number;
  /** Total promised payout (used in drawer copy). */
  expectedPayout?: number;
};

export async function startMembershipPayment(amount: number, options: StartMembershipPaymentOptions = {}) {
  if (inFlight) return;
  setInFlight(true);

  try {
    trackClarityEvent(ClarityEvents.MEMBERSHIP_PAYMENT_STARTED);
    trackFBInitiateCheckout(amount, 'NGN');
    trackLogRocketEvent(LREvents.ACTIVATION_PAYMENT_STARTED, { amount });

    const autoBuySpots = Math.max(0, Math.min(Number(options.autoBuySpots) || 0, 100));
    const expectedPayout = options.expectedPayout;

    // Server decides the LIVE provider at click-time. No client cache.
    const { data, error } = await supabase.functions.invoke('start-payment', {
      body: {
        amount,
        metadata: {
          purpose: 'membership',
          auto_buy_spots: autoBuySpots,
          expected_payout: expectedPayout,
        },
      },
    });

    if (error || data?.error) {
      trackClarityEvent(ClarityEvents.ERROR_MEMBERSHIP_PAYMENT);
      trackLogRocketEvent(LREvents.ACTIVATION_PAYMENT_FAILED, {
        amount,
        reason: String(error?.message || data?.details || data?.error || 'unknown'),
      });
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
      trackLogRocketEvent(LREvents.ACTIVATION_PAYMENT_REDIRECTED, {
        amount,
        provider: 'moniepoint',
      });
      openMoniepointDrawer({
        amount,
        purpose: 'membership',
        autoBuySpots,
        expectedPayout,
        onClose: options.onMoniepointClose,
        onSuccess: options.onMoniepointSuccess,
      });
      setInFlight(false);
      return;
    }

    if (data?.paymentLink) {
      trackClarityEvent(ClarityEvents.MEMBERSHIP_REDIRECT);
      trackLogRocketEvent(LREvents.ACTIVATION_PAYMENT_REDIRECTED, {
        amount,
        provider: String(data?.provider || 'flutterwave'),
      });
      window.location.href = data.paymentLink;
      return; // page unloading
    }

    trackClarityEvent(ClarityEvents.ERROR_MEMBERSHIP_PAYMENT);
    trackLogRocketEvent(LREvents.ACTIVATION_PAYMENT_FAILED, {
      amount,
      reason: 'no_payment_link',
    });
    toast({
      title: 'Payment Error',
      description: 'No payment link received',
      variant: 'destructive',
    });
    setInFlight(false);

  } catch (e: any) {
    trackClarityEvent(ClarityEvents.ERROR_MEMBERSHIP_PAYMENT);
    trackLogRocketEvent(LREvents.ACTIVATION_PAYMENT_FAILED, {
      amount,
      reason: String(e?.message || 'exception'),
    });
    toast({
      title: 'Payment Failed',
      description: e?.message || 'Please try again',
      variant: 'destructive',
    });
    setInFlight(false);
  }
}
