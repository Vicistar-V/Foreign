import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { openMoniepointDrawer } from '@/lib/moniepointDrawerStore';

/**
 * Kick off a deposit top-up. The `start-payment` edge function decides
 * which provider handles it — we never hardcode Moniepoint on the client.
 *  • provider === 'moniepoint'  → open the Moniepoint drawer
 *  • paymentLink                 → hosted redirect (Flutterwave / Paystack / etc.)
 */
export type StartDepositOptions = {
  amount: number;
  autoBuySpots?: number;
  expectedPayout?: number;
  metadata?: Record<string, unknown>;
  onMoniepointSuccess?: () => void;
  onMoniepointClose?: () => void;
};

export async function startDepositPayment(opts: StartDepositOptions) {
  const { amount, autoBuySpots, expectedPayout, metadata, onMoniepointSuccess, onMoniepointClose } = opts;
  if (!amount || amount < 50) {
    toast({ title: 'Invalid amount', variant: 'destructive' });
    return;
  }

  try {
    const { data, error } = await supabase.functions.invoke('start-payment', {
      body: { amount, metadata: { purpose: 'deposit', ...(metadata || {}) } },
    });

    if (error || data?.error) {
      toast({
        title: 'Payment Error',
        description: error?.message || data?.details || data?.error || 'Failed to start payment',
        variant: 'destructive',
      });
      return;
    }

    if (data?.provider === 'moniepoint') {
      openMoniepointDrawer({
        amount,
        purpose: 'deposit',
        autoBuySpots,
        expectedPayout,
        onSuccess: onMoniepointSuccess,
        onClose: onMoniepointClose,
      });
      return;
    }

    if (data?.paymentLink) {
      window.location.href = data.paymentLink;
      return;
    }

    toast({ title: 'Payment Error', description: 'No payment link received', variant: 'destructive' });
  } catch (e: any) {
    toast({ title: 'Payment Failed', description: e?.message || 'Please try again', variant: 'destructive' });
  }
}
