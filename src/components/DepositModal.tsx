import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDropStatus } from '@/hooks/useDropStatus';
import { Loader2, AlertTriangle, Lock, ChevronDown } from 'lucide-react';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';
import { trackFBInitiateCheckout } from '@/lib/facebookPixel';
import { PaymentAttemptsSection } from '@/components/PaymentAttemptsSection';
import { openMoniepointDrawer } from '@/lib/moniepointDrawerStore';
import { triggerHaptic } from '@/lib/haptics';

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasDebt?: boolean;
  /**
   * How many spots the user already picked on the upstream screen (MachinesCard).
   * When provided, the drawer becomes a pure receipt with NO quantity choice.
   */
  autoBuySpots?: number;
}

/**
 * Bank-transfer doorway.
 *
 * The user already picked N spots upstream. Their next tap must feel like the
 * ONLY next step — no bundle grid, no emoji pills, no menu. Receipt → tap → bank.
 */
export const DepositModal = ({
  open,
  onOpenChange,
  hasDebt = false,
  autoBuySpots,
}: DepositModalProps) => {
  const { data: config } = usePlatformConfig();
  const { data: dropStatus } = useDropStatus();
  const isMobile = useIsMobile();
  const hasTrackedOpen = useRef(false);

  const entryFee = config?.drop_entry_fee || 5000;
  const profitAmount = config?.drop_target_amount || 10000;
  const MIN_DEPOSIT = 50;

  // Existing payout target from user's active ticket (preserves the promise
  // thread across MachinesCard → BuySpotDrawer → DepositModal). When the user
  // has no active ticket yet, base is 0 and payout becomes N × profit.
  const existingTarget = Number(dropStatus?.user?.shared_drop?.target_amount ?? 0) || 0;

  // Pre-decided spot count from upstream. Falls back to 1 if not provided.
  const lockedSpots = Math.max(1, autoBuySpots ?? 1);
  const lockedAmount = lockedSpots * entryFee;

  const [customMode, setCustomMode] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const customInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && !hasTrackedOpen.current) {
      trackFBInitiateCheckout();
      hasTrackedOpen.current = true;
    }
    if (!open) {
      hasTrackedOpen.current = false;
      setCustomMode(false);
      setCustomAmount('');
    }
  }, [open]);

  useEffect(() => {
    if (customMode) customInputRef.current?.focus();
  }, [customMode]);

  const customNum = parseInt(customAmount, 10) || 0;
  const chargeAmount = customMode ? customNum : lockedAmount;
  const spotsToGet = customMode ? Math.floor(customNum / entryFee) : lockedSpots;
  // TRUE new payout — preserves the exact "your payout becomes ₦X" thread from
  // MachinesCard. Adds this deposit's spots on top of the user's existing target.
  const outcomePayout = existingTarget + spotsToGet * profitAmount;
  const projectedPayout = existingTarget + lockedSpots * profitAmount;

  const handleClose = () => {
    setCustomMode(false);
    setCustomAmount('');
    onOpenChange(false);
  };

  const handleDeposit = async () => {
    if (chargeAmount < MIN_DEPOSIT) {
      toast({
        title: 'Enter amount',
        description: `Minimum is ₦${MIN_DEPOSIT.toLocaleString()}`,
        variant: 'destructive',
      });
      return;
    }

    triggerHaptic('medium');
    setLoading(true);
    trackClarityEvent(ClarityEvents.DEPOSIT_INITIATED);

    try {
      const { data, error } = await supabase.functions.invoke('start-payment', {
        body: {
          amount: chargeAmount,
          metadata: {
            purpose: 'deposit',
            auto_buy_spots: spotsToGet,
          },
        },
      });

      if (error) {
        trackClarityEvent(ClarityEvents.ERROR_DEPOSIT_API);
        toast({
          title: 'Payment error',
          description: error.message || 'Please try again',
          variant: 'destructive',
        });
        return;
      }

      if (data?.error) {
        trackClarityEvent(ClarityEvents.ERROR_DEPOSIT_API);
        toast({
          title: 'Payment error',
          description: data.details || data.error,
          variant: 'destructive',
        });
        return;
      }

      if (data?.provider === 'moniepoint') {
        onOpenChange(false);
        openMoniepointDrawer({
          amount: chargeAmount,
          purpose: 'deposit',
          autoBuySpots: spotsToGet,
          expectedPayout: outcomePayout,
        });
        return;
      }

      if (data?.paymentLink) {
        trackClarityEvent(ClarityEvents.DEPOSIT_REDIRECT);
        window.location.href = data.paymentLink;
      } else {
        toast({
          title: 'Payment error',
          description: 'No payment link received',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      trackClarityEvent(ClarityEvents.ERROR_DEPOSIT_GENERAL);
      toast({
        title: 'Payment failed',
        description: err.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const maintenanceContent = (
    <Alert className="bg-caution-muted border-caution text-caution-foreground">
      <AlertTriangle className="h-4 w-4 text-caution" />
      <AlertDescription className="text-caution-foreground">
        <strong className="block mb-1">Under maintenance</strong>
        Deposits are paused for a moment. Please come back shortly.
      </AlertDescription>
    </Alert>
  );

  const content = (
    <div className="space-y-5">
      {/* Header — anticipation, not a false claim */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {hasDebt ? 'Clear your balance' : 'One transfer away'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {hasDebt
            ? `Send ₦${lockedAmount.toLocaleString()} to keep your campaign going.`
            : `Send ₦${chargeAmount.toLocaleString()} now, get ₦${outcomePayout.toLocaleString()} paid to you.`}
        </p>
      </div>

      {/* Hero — send/receive math, the strongest single frame */}
      {!customMode ? (
        <div className="rounded-2xl border border-border bg-muted/20 p-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="text-center">
              <p className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                You send
              </p>
              <p className="text-2xl font-black tabular-nums text-foreground mt-1 leading-none">
                ₦{chargeAmount.toLocaleString()}
              </p>
            </div>
            <div className="text-muted-foreground text-lg font-bold">→</div>
            <div className="text-center">
              <p className="text-[10px] font-bold tracking-wider uppercase text-emerald-500/90">
                You receive
              </p>
              <p className="text-2xl font-black tabular-nums text-emerald-500 mt-1 leading-none">
                ₦{outcomePayout.toLocaleString()}
              </p>
            </div>
          </div>
          <p className="text-center text-[11px] text-muted-foreground mt-3 pt-3 border-t border-border/50">
            Adds {spotsToGet} {spotsToGet === 1 ? 'ad share' : 'ad shares'} · ₦{profitAmount.toLocaleString()} paid per share
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground text-center">
            Choose your amount
          </p>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">
              ₦
            </span>
            <Input
              ref={customInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value.replace(/\D/g, ''))}
              placeholder="0"
              className="h-14 pl-10 pr-4 text-2xl font-bold text-center bg-muted/40 border-2 border-border rounded-2xl focus:border-foreground"
            />
          </div>
          {customNum >= entryFee && (
            <p className="text-center text-xs text-emerald-500 font-semibold">
              You'll receive ₦{outcomePayout.toLocaleString()} ({spotsToGet}{' '}
              {spotsToGet === 1 ? 'share' : 'shares'})
            </p>
          )}
          <p className="text-[11px] text-center text-muted-foreground">
            Each share costs ₦{entryFee.toLocaleString()}
          </p>
        </div>
      )}

      {/* Trust — reassurance without introducing doubt */}
      <div className="flex items-center justify-center gap-2 rounded-xl bg-muted/30 border border-border/50 py-2.5 px-3">
        <Lock className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-snug">
          Safe bank transfer via <span className="font-semibold text-foreground">Moniepoint</span>
          {' · '}Money confirmed instantly
        </p>
      </div>
    </div>
  );

  const cta = (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleDeposit}
        disabled={loading || chargeAmount < MIN_DEPOSIT || config?.maintenance_mode}
        className="w-full h-14 rounded-2xl font-bold text-base bg-foreground text-background disabled:opacity-50 active:scale-[0.99] transition-transform flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Getting your bank details…
          </>
        ) : (
          <>Continue to bank transfer</>
        )}
      </button>

      {/* Escape hatch — neutral wording, not a competing choice */}
      <button
        type="button"
        onClick={() => {
          triggerHaptic('light');
          setCustomMode((v) => !v);
          if (customMode) setCustomAmount('');
        }}
        className="w-full text-center text-[12px] text-muted-foreground underline underline-offset-2 py-1 active:opacity-70"
      >
        {customMode ? '← Use suggested amount' : 'Change amount'}
      </button>

      {/* Helpful frame, not problem frame */}
      <details className="group">
        <summary className="list-none flex items-center justify-center gap-1 text-[11px] text-muted-foreground cursor-pointer py-1 active:opacity-70">
          Need help paying?
          <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-2">
          <PaymentAttemptsSection purpose="deposit" onSuccess={() => onOpenChange(false)} />
        </div>
      </details>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleClose}>
        <DrawerContent className="max-h-[90vh] flex flex-col rounded-t-[20px] bg-background border-t border-border/50">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-8 h-1 rounded-full bg-muted-foreground/20" />
          </div>
          <div className="px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] overflow-y-auto">
            {config?.maintenance_mode ? maintenanceContent : content}
            {!config?.maintenance_mode && <div className="mt-5">{cta}</div>}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px] rounded-2xl">
        <div className="py-2">
          {config?.maintenance_mode ? maintenanceContent : content}
          {!config?.maintenance_mode && <div className="mt-5">{cta}</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
};
