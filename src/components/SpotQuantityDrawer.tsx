import { useEffect, useMemo, useState } from 'react';
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Minus, Plus, ArrowRight, Loader2, TrendingUp } from 'lucide-react';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { startMembershipPayment, useMembershipPaymentLoading } from '@/lib/startMembershipPayment';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { DEFAULT_PAYOUT_PER_SPOT } from '@/lib/currencyUtils';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { logUserActivity } from '@/lib/userActivityLogger';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const MAX_SPOTS = 20;

export function SpotQuantityDrawer({ open, onOpenChange }: Props) {
  const { data: cfg } = usePlatformConfig();
  const firstSpotPrice = Number(cfg?.membership_fee ?? 5000);
  const extraSpotPrice = Number(cfg?.drop_entry_fee ?? 5000);
  const payoutPerSpot = Number(cfg?.payout_per_spot ?? DEFAULT_PAYOUT_PER_SPOT);
  const paying = useMembershipPaymentLoading();
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (open) setQty(1);
  }, [open]);

  const totalPayout = qty * payoutPerSpot;
  const totalPay = useMemo(
    () => (qty === 0 ? 0 : firstSpotPrice + Math.max(0, qty - 1) * extraSpotPrice),
    [qty, firstSpotPrice, extraSpotPrice],
  );

  const dec = () => {
    if (qty <= 1 || paying) return;
    triggerHaptic('light');
    setQty((q) => Math.max(1, q - 1));
  };
  const inc = () => {
    if (qty >= MAX_SPOTS || paying) return;
    triggerHaptic('light');
    setQty((q) => Math.min(MAX_SPOTS, q + 1));
  };

  const confirm = async () => {
    if (paying || qty < 1) return;
    triggerHaptic('heavy');
    trackClarityEvent(ClarityEvents.ACTIVATION_PAY_BUTTON_CLICKED);
    logUserActivity('activation_qty_confirmed', 'button_click', {
      spots: qty,
      total: totalPay,
      expected_payout: totalPayout,
    });
    await startMembershipPayment(totalPay, {
      autoBuySpots: Math.max(0, qty - 1),
      expectedPayout: totalPayout,
    });
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-zinc-950 border-t border-white/10 text-white max-h-[92vh]">
        <VisuallyHidden>
          <DrawerTitle>How many ad shares can you afford?</DrawerTitle>
          <DrawerDescription>Each share pays ₦10,000 when your campaign finishes.</DrawerDescription>
        </VisuallyHidden>

        <div className="mx-auto w-full max-w-md px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
          <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-5" />

          <h2 className="text-[22px] font-extrabold text-center leading-tight">
            How many ad shares can you afford?
          </h2>
          <p className="text-center text-white/60 text-sm mt-1.5">
            ₦{firstSpotPrice.toLocaleString()} for one share. It pays you ₦
            {payoutPerSpot.toLocaleString()} back. Same price for every share.
          </p>

          {/* PAYOUT HERO — the star of the show */}
          <div className="mt-6 rounded-3xl bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent border border-emerald-400/30 px-5 py-6 text-center">
            <div className="inline-flex items-center gap-1.5 text-emerald-300 text-[11px] font-semibold uppercase tracking-wider">
              <TrendingUp className="h-3.5 w-3.5" />
              Your Payout
            </div>
            <div
              key={totalPayout}
              className="mt-2 text-5xl font-black tabular-nums text-emerald-300 payout-pop"
            >
              ₦{totalPayout.toLocaleString()}
            </div>
            <div className="mt-1 text-white/70 text-xs">
              {qty} share{qty === 1 ? '' : 's'} · paid when your campaign finishes
            </div>
          </div>

          {/* +/- CONTROLS */}
          <div className="mt-6 flex items-center justify-between gap-4">
            <button
              onClick={dec}
              disabled={qty <= 1 || paying}
              aria-label="Decrease shares"
              className={cn(
                'h-16 w-16 rounded-2xl bg-white/10 border border-white/15 grid place-items-center transition-all active:scale-95',
                (qty <= 1 || paying) && 'opacity-30',
              )}
            >
              <Minus className="h-7 w-7" />
            </button>

            <div className="flex-1 text-center">
              <div className="text-[11px] uppercase tracking-wider text-white/50 font-semibold">
                Shares
              </div>
              <div
                key={qty}
                className="text-6xl font-black tabular-nums leading-none mt-1 qty-pop"
              >
                {qty}
              </div>
            </div>

            <button
              onClick={inc}
              disabled={qty >= MAX_SPOTS || paying}
              aria-label="Increase shares"
              className={cn(
                'h-16 w-16 rounded-2xl bg-emerald-500 border border-emerald-400 grid place-items-center transition-all active:scale-95 shadow-lg shadow-emerald-500/30',
                (qty >= MAX_SPOTS || paying) && 'opacity-40',
              )}
            >
              <Plus className="h-7 w-7 text-black" />
            </button>
          </div>

          {/* PAY BUTTON — always live now that the default is 1 share. */}
          <Button
            onClick={confirm}
            disabled={paying}
            className="mt-6 w-full h-16 rounded-2xl text-lg font-extrabold active:scale-[0.98] transition-all bg-white hover:bg-white/90 !text-black"
          >
            {paying ? (
              <>
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Starting…
              </>
            ) : (
              <>
                Pay ₦{totalPay.toLocaleString()}
                <ArrowRight className="ml-2 h-6 w-6" />
              </>
            )}
          </Button>

          <p className="mt-3 text-center text-[11px] text-white/40">
            ₦{firstSpotPrice.toLocaleString()} per share · secure bank transfer · money-back if your campaign can't start
          </p>
        </div>

        <style>{`
          @keyframes payout-pop { 0% { transform: scale(0.92); opacity: 0.4; } 100% { transform: scale(1); opacity: 1; } }
          .payout-pop { animation: payout-pop 0.28s ease-out; }
          @keyframes qty-pop { 0% { transform: scale(0.7); } 60% { transform: scale(1.08); } 100% { transform: scale(1); } }
          .qty-pop { animation: qty-pop 0.22s ease-out; }
        `}</style>
      </DrawerContent>
    </Drawer>
  );
}
