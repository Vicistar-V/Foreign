import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import {
  Hand,
  Hourglass,
  Banknote,
  X,
  ArrowRight,
  Repeat,
  Info,
  Loader2,
  RotateCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { useMembershipPaymentLoading } from '@/lib/startMembershipPayment';
import { openRestoreCapacityDrawer } from '@/lib/restoreCapacityStore';

interface PendingCycleExplainerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingBalance: number;
  perCyclePayout: number;
  hasSpots: boolean;
  isMember: boolean;
  isRetired?: boolean;
  onActivate?: () => void;
}

/**
 * The full explainer drawer — opened from the small strip / wallet row.
 * Plain language so anyone (even Grandma) understands how pending → cash.
 */
export function PendingCycleExplainerDrawer({
  open,
  onOpenChange,
  pendingBalance,
  perCyclePayout,
  hasSpots,
  isMember,
  isRetired = false,
  onActivate,
}: PendingCycleExplainerDrawerProps) {
  const navigate = useNavigate();
  const paying = useMembershipPaymentLoading();

  const steps = [
    {
      Icon: Hand,
      title: 'You pick pictures',
      body: 'Every round you finish adds money to your pending balance.',
      tone: 'text-sky-400',
      bg: 'bg-sky-500/10',
      border: 'border-sky-500/20',
    },
    {
      Icon: Hourglass,
      title: 'Your campaign fills up',
      body: 'Your campaign moves toward 100% while you keep picking.',
      tone: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    {
      Icon: Banknote,
      title: 'Campaign hits 100% — you get paid',
      body: `When your campaign reaches 100%, your ad share pays out a full ₦${perCyclePayout.toLocaleString()} lump sum straight to your withdrawable wallet.`,
      tone: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      Icon: Repeat,
      title: 'Share finishes — activate another to keep earning',
      body: 'Once paid, that ad share is finished. Activate another any time you want to keep earning.',
      tone: 'text-primary',
      bg: 'bg-primary/10',
      border: 'border-primary/20',
    },
  ];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] overflow-hidden">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <button
          type="button"
          aria-label="Close"
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3 p-2 rounded-full hover:bg-muted transition-colors z-10"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        <div className="px-5 pb-7 overflow-y-auto">
          {/* Title block */}
          <div className="pt-1 pb-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              How your money grows
            </p>
            <h2 className="text-xl font-bold text-foreground mt-0.5 leading-snug">
              Pending becomes cash
              <br />
              when your campaign pays.
            </h2>
          </div>

          {/* Live snapshot */}
          <div className="rounded-2xl border border-border/60 bg-card/40 p-4 mb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  You have
                </p>
                <p className="text-2xl font-bold tabular-nums text-foreground leading-tight">
                  ₦{pendingBalance.toLocaleString()}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  waiting for your campaign to finish
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="text-right min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Your ad share pays
                </p>
                <p className="text-2xl font-bold tabular-nums text-emerald-400 leading-tight">
                  ₦{perCyclePayout.toLocaleString()}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  per ad share, lump sum
                </p>
              </div>
            </div>
          </div>

          {/* Steps */}
          <ol className="space-y-2.5">
            {steps.map((s, i) => (
              <li
                key={i}
                className={cn(
                  'rounded-2xl border p-3 flex items-start gap-3',
                  s.border,
                  s.bg,
                )}
              >
                <div
                  className={cn(
                    'h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-background/40 border',
                    s.border,
                  )}
                >
                  <s.Icon className={cn('h-4 w-4', s.tone)} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    {i + 1}. {s.title}
                  </p>
                  <p className="text-[12px] text-muted-foreground mt-1 leading-snug">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {/* Context-aware footer note */}
          {!isMember ? (
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-[12px] text-foreground leading-snug">
                <span className="font-semibold text-amber-400">Heads up:</span>{' '}
                Your pending stays stuck until you become a member and activate at
                least one ad share. Without a share, no payout can reach you.
              </p>
            </div>
          ) : isRetired ? (
            <div className="mt-4 rounded-2xl border border-orange-500/30 bg-orange-500/5 p-3">
              <p className="text-[12px] text-foreground leading-snug">
                <span className="font-semibold text-orange-400">Your last ad share just finished.</span>{' '}
                Activate another share so this pending balance can be released to you.
              </p>
            </div>
          ) : !hasSpots ? (
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-[12px] text-foreground leading-snug">
                <span className="font-semibold text-amber-400">Tip:</span> You
                don't have an ad share yet. Activate one so your pending balance can be
                released to you.
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="text-[12px] text-foreground leading-snug">
                <span className="font-semibold text-emerald-400">
                  More ad shares = bigger payout.
                </span>{' '}
                Each share pays ₦{perCyclePayout.toLocaleString()} when its campaign hits 100% —
                so more shares means more money landing in your wallet.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => {
                triggerHaptic('light');
                onOpenChange(false);
                navigate('/task');
              }}
            >
              Earn more pending
            </Button>
            {!isMember && onActivate ? (
              <Button
                className="h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-80"
                disabled={paying}
                onClick={() => {
                  triggerHaptic('medium');
                  onOpenChange(false);
                  onActivate();
                }}
              >
                {paying ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Starting…
                  </span>
                ) : (
                  'Become a member'
                )}
              </Button>
            ) : isRetired ? (
              <Button
                className="h-11 rounded-xl bg-orange-500 hover:bg-orange-600 text-white gap-2"
                onClick={() => {
                  triggerHaptic('medium');
                  onOpenChange(false);
                  // P1-6: thread the pending balance so the Restore drawer
                  // can surface "restoring releases your ₦X pending" — the
                  // user loses that framing exactly when they need it most.
                  openRestoreCapacityDrawer({ pendingBalance });
                }}
              >
                <RotateCw className="h-4 w-4" />
                Activate another share
              </Button>

            ) : (
              <Button
                className="h-11 rounded-xl"
                onClick={() => {
                  triggerHaptic('light');
                  onOpenChange(false);
                  navigate('/dashboard');
                }}
              >
                See my ad shares
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/* ============================================================
 * Compact strip used on Transactions / other protected pages.
 * Self-contained: opens the drawer when tapped.
 * ============================================================ */
interface PendingCycleStripProps {
  pendingBalance: number;
  perCyclePayout: number;
  hasSpots: boolean;
  isMember: boolean;
  isRetired?: boolean;
  onActivate?: () => void;
  className?: string;
}

export function PendingCycleStrip({
  pendingBalance,
  perCyclePayout,
  hasSpots,
  isMember,
  isRetired = false,
  onActivate,
  className,
}: PendingCycleStripProps) {
  const [open, setOpen] = useState(false);
  if (pendingBalance <= 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          triggerHaptic('light');
          setOpen(true);
        }}
        className={cn(
          'w-full flex items-center justify-between gap-3 rounded-2xl border transition-colors px-3 py-2.5 text-left',
          isRetired
            ? 'border-orange-500/25 bg-orange-500/5 hover:bg-orange-500/10'
            : 'border-sky-500/20 bg-sky-500/5 hover:bg-sky-500/10',
          className,
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className={cn(
              'absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping',
              isRetired ? 'bg-orange-400' : 'bg-sky-400',
            )} />
            <span className={cn(
              'relative inline-flex h-2 w-2 rounded-full',
              isRetired ? 'bg-amber-400' : 'bg-sky-400',
            )} />
          </span>
          <div className="min-w-0">
            <div className={cn(
              'text-[11px] font-semibold uppercase tracking-wider',
              isRetired ? 'text-amber-400/90' : 'text-sky-400/90',
            )}>
              {isRetired ? 'Your money is ready — needs an ad share to land in' : 'Your campaign is still filling up'}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              ₦{pendingBalance.toLocaleString()} pending — tap to see how it
              becomes cash
            </div>
          </div>
        </div>
        <Info className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>


      <PendingCycleExplainerDrawer
        open={open}
        onOpenChange={setOpen}
        pendingBalance={pendingBalance}
        perCyclePayout={perCyclePayout}
        hasSpots={hasSpots}
        isMember={isMember}
        isRetired={isRetired}
        onActivate={onActivate}
      />
    </>
  );
}

/* ============================================================
 * Standalone Restore chip — surfaces the retirement CTA on pages
 * even when pending balance is 0 (e.g. Notifications / Transactions
 * right after a payout landed). Self-contained.
 * ============================================================ */
export function RestoreCapacityChip({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        triggerHaptic('medium');
        openRestoreCapacityDrawer();
      }}
      className={cn(
        'w-full flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors px-3 py-2.5 text-left',
        className,
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="h-8 w-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
          <RotateCw className="h-4 w-4 text-emerald-500" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500/90">
            Campaign finished — money paid
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            Send your ad share back to work in one tap
          </div>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-emerald-500 shrink-0" />
    </button>

  );
}

