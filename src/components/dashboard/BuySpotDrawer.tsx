import { useState, useEffect } from 'react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { useBuySpot, useDropStatus } from '@/hooks/useDropStatus';
import { useBalances } from '@/hooks/useBalances';
import { useAuth } from '@/hooks/useAuth';
import confetti from 'canvas-confetti';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';
import {
  getCachedIsRetired,
  openRestoreCapacityDrawer,
} from '@/lib/restoreCapacityStore';
import { startDepositPayment } from '@/lib/startDepositPayment';
import { triggerHaptic } from '@/lib/haptics';
import { Loader2, Check, Wallet, Banknote, ChevronRight, Minus, Plus } from 'lucide-react';

const triggerConfetti = () => {
  const end = Date.now() + 700;
  const colors = ['#10b981', '#f59e0b', '#ffffff'];
  (function frame() {
    confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors });
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
};

interface BuySpotDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: {
    entry_fee: number;
    target_amount: number;
    profit_amount: number;
    system_active: boolean;
  };
  isLegacyMember?: boolean;
  /** Quantity user already picked on MachinesCard (1, 3, or 5). */
  defaultQuantity?: number;
}

/**
 * Confirmation drawer — NOT a shop.
 *
 * The user already picked N spots on MachinesCard ("Grow my payout to ₦60,000").
 * This drawer's ONLY job is to confirm the money math and take one tap.
 * No re-asking quantity. No decision-fatigue chips. Receipt, not menu.
 */
export function BuySpotDrawer({
  open,
  onOpenChange,
  config,
  isLegacyMember = false,
  defaultQuantity = 1,
}: BuySpotDrawerProps) {
  const { user } = useAuth();
  const { data: balances } = useBalances(user?.id);
  const { data: dropStatus } = useDropStatus();
  const { mutate: buySpot, isPending } = useBuySpot();
  const [sourceWallet, setSourceWallet] = useState<'deposit' | 'earnings'>('deposit');
  const [quantity, setQuantity] = useState<number>(Math.max(1, defaultQuantity));

  // Reset qty whenever the drawer opens with a new default
  useEffect(() => {
    if (open) setQuantity(Math.max(1, defaultQuantity));
  }, [open, defaultQuantity]);

  // Retirement interceptor — synchronous so wrong drawer never paints.
  const retiredBlocked = open && getCachedIsRetired();
  useEffect(() => {
    if (retiredBlocked) {
      onOpenChange(false);
      openRestoreCapacityDrawer();
    }
  }, [retiredBlocked, onOpenChange]);

  const entryFee = config?.entry_fee || 5000;
  const profitAmount = config?.profit_amount || 10000;

  const shared = dropStatus?.user?.shared_drop;
  const currentTarget = Number(shared?.target_amount ?? profitAmount) || profitAmount;

  const depositBalance = balances?.deposit_balance || 0;
  const earningsBalance = balances?.earnings_balance || 0;

  const MAX_QTY = 20;
  const totalCost = entryFee * quantity;
  const addedPayout = profitAmount * quantity;
  const newTarget = currentTarget + addedPayout;

  const dec = () => { triggerHaptic('light'); setQuantity(q => Math.max(1, q - 1)); };
  const inc = () => { triggerHaptic('light'); setQuantity(q => Math.min(MAX_QTY, q + 1)); };

  const canUseDeposit = depositBalance >= totalCost;
  const canUseEarnings = earningsBalance >= totalCost;
  const bothWallets = canUseDeposit && canUseEarnings;
  const anyFunds = canUseDeposit || canUseEarnings;
  const depositTopUpAmount = Math.max(0, totalCost - depositBalance);

  // Auto-pick whichever wallet can pay
  useEffect(() => {
    if (canUseDeposit) setSourceWallet('deposit');
    else if (canUseEarnings) setSourceWallet('earnings');
  }, [canUseDeposit, canUseEarnings, open]);

  const activeBalance = sourceWallet === 'deposit' ? depositBalance : earningsBalance;
  const shortfall = Math.max(0, totalCost - Math.max(depositBalance, earningsBalance));
  const canConfirm =
    (sourceWallet === 'deposit' && canUseDeposit) ||
    (sourceWallet === 'earnings' && canUseEarnings);

  const handleConfirm = () => {
    triggerHaptic('medium');
    buySpot(
      { sourceWallet, count: quantity },
      {
        onSuccess: () => {
          triggerHaptic('success');
          triggerConfetti();
          if (isLegacyMember) trackClarityEvent(ClarityEvents.LEGACY_MEMBER_CONVERTED);
          setTimeout(() => onOpenChange(false), 800);
        },
      },
    );
  };

  const handleTopUp = () => {
    triggerHaptic('medium');
    const amountNeeded = Math.max(100, depositTopUpAmount || totalCost);
    onOpenChange(false);
    startDepositPayment({
      amount: amountNeeded,
      autoBuySpots: quantity,
      expectedPayout: newTarget,
    });
  };

  if (!config?.system_active) {
    return (
      <Drawer open={open && !retiredBlocked} onOpenChange={onOpenChange}>
        <DrawerContent className="bg-background border-t border-border/50">
          <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
            <p className="text-base font-semibold text-foreground">Campaigns paused — back soon</p>
            <p className="text-xs text-muted-foreground mt-1">
              You'll be able to grow your payout in a moment.
            </p>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Drawer open={open && !retiredBlocked} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-background border-t border-border/50 max-h-[92dvh] overflow-hidden">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-8 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        <div className="px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] overflow-y-auto">
          {/* ── HERO: the outcome ─────────────────────────────── */}
          <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
            Your payout becomes
          </p>
          <div className="mt-1 flex items-baseline gap-2 flex-wrap">
            <span className="text-[40px] leading-none font-black tabular-nums text-success">
              ₦{newTarget.toLocaleString()}
            </span>
            <span className="text-sm font-semibold tabular-nums text-success/80">
              +₦{addedPayout.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 tabular-nums">
            from ₦{currentTarget.toLocaleString()}
          </p>

          {/* ── STEPPER: the only control ─────────────────────── */}
          <div className="mt-6 flex items-center justify-between rounded-2xl bg-card/60 border border-border p-2.5">
            <button
              type="button"
              onClick={dec}
              disabled={quantity <= 1}
              aria-label="Decrease spots"
              className="h-12 w-12 rounded-xl bg-muted/40 text-foreground flex items-center justify-center disabled:opacity-30 active:scale-95 transition"
            >
              <Minus className="h-5 w-5" strokeWidth={2.5} />
            </button>
            <div className="text-center">
              <p className="text-4xl font-black tabular-nums text-foreground leading-none">
                {quantity}
              </p>
              <p className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mt-1">
                {quantity === 1 ? 'share' : 'shares'}
              </p>
            </div>
            <button
              type="button"
              onClick={inc}
              disabled={quantity >= MAX_QTY}
              aria-label="Increase spots"
              className="h-12 w-12 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center disabled:opacity-30 active:scale-95 transition"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </div>

          {/* ── PAY LINE: single row, no cards ─────────────────── */}
          <div className="mt-5 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">You pay</span>
            <span className="text-lg font-bold tabular-nums text-foreground">
              ₦{totalCost.toLocaleString()}
            </span>
          </div>

          {/* Wallet picker — only when user actually has a choice */}
          {anyFunds && bothWallets && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <WalletPill
                icon={<Wallet className="h-4 w-4" />}
                label="Deposit"
                balance={depositBalance}
                selected={sourceWallet === 'deposit'}
                onClick={() => { triggerHaptic('light'); setSourceWallet('deposit'); }}
              />
              <WalletPill
                icon={<Banknote className="h-4 w-4" />}
                label="Earnings"
                balance={earningsBalance}
                selected={sourceWallet === 'earnings'}
                onClick={() => { triggerHaptic('light'); setSourceWallet('earnings'); }}
              />
            </div>
          )}

          {/* Payment source caption — one quiet line, always shown */}
          {anyFunds && !bothWallets && (
            <p className="mt-1 text-xs text-muted-foreground">
              From your {sourceWallet === 'deposit' ? 'deposit money' : 'earnings'} · ₦
              {activeBalance.toLocaleString()} available
            </p>
          )}
          {!anyFunds && (
            <p className="mt-1 text-xs text-muted-foreground">
              From a quick bank transfer
            </p>
          )}

          {/* ── CTA: one button, same copy always ─────────────── */}
          <button
            type="button"
            onClick={anyFunds ? handleConfirm : handleTopUp}
            disabled={isPending || (anyFunds && !canConfirm)}
            className="mt-6 w-full h-14 rounded-2xl font-bold text-base bg-foreground text-background disabled:opacity-50 active:scale-[0.99] transition-transform flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Confirming…
              </>
            ) : (
              <>Add {quantity} {quantity === 1 ? 'share' : 'shares'} · ₦{totalCost.toLocaleString()}</>
            )}
          </button>

          <p className="text-[11px] text-center text-muted-foreground mt-3">
            Every share pays once — no exceptions.
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function WalletPill({
  icon,
  label,
  balance,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  balance: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-2xl border-2 p-3 text-left transition-all active:scale-[0.98] ${
        selected
          ? 'border-foreground bg-foreground/5'
          : 'border-border bg-background'
      }`}
    >
      {selected && (
        <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-foreground flex items-center justify-center">
          <Check className="h-2.5 w-2.5 text-background" strokeWidth={3} />
        </div>
      )}
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-base font-bold tabular-nums text-foreground mt-1.5">
        ₦{balance.toLocaleString()}
      </p>
    </button>
  );
}
