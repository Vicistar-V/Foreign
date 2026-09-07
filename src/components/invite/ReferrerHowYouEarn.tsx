import { useState } from 'react';
import { Gift, TimerReset, Rocket, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReferrerHowYouEarnProps {
  bonusBatches: number;
  referralCashBonus: number;
  referralPendingBonus: number;
  nairaPerBatch: number;
  /** In unlimited mode we hide the "+extra batches today" tile since there is no daily cap. */
  unlimited?: boolean;
}

/**
 * Retirement Economy — how referrers earn.
 * HERO benefit is the instant pending-balance jump (referral_pending_bonus).
 * Second is the flat cash bonus, paid per share the friend activates.
 * Third (only when NOT unlimited) is the "+extra batches today" boost.
 */
export const ReferrerHowYouEarn = ({
  bonusBatches,
  referralCashBonus,
  referralPendingBonus,
  nairaPerBatch,
  unlimited = false,
}: ReferrerHowYouEarnProps) => {
  const [open, setOpen] = useState(false);
  const extraEarnings = bonusBatches * nairaPerBatch;
  const showBatchTile = !unlimited && bonusBatches > 0;

  return (
    <div className="space-y-3">
      {/* HERO tile — pending jump, full width, visually dominant */}
      <div className="rounded-2xl border-2 border-amber-400/30 bg-gradient-to-br from-amber-500/[0.12] to-emerald-500/[0.08] p-4 relative overflow-hidden">
        <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-amber-400/10 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-1.5 mb-1">
            <Rocket className="h-3.5 w-3.5 text-amber-400" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
              Pending jump — instant
            </p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-foreground leading-tight">
            ₦{referralPendingBonus.toLocaleString()}
          </p>
          <p className="text-[12px] text-muted-foreground leading-snug mt-1">
            Lands straight in your pending balance the moment a friend activates —
            skip the grind and get closer to payout instantly.
          </p>
        </div>
      </div>

      {/* Secondary tiles */}
      <div className={cn('grid gap-2', showBatchTile ? 'grid-cols-2' : 'grid-cols-1')}>
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] p-3">
          <div className="flex items-center gap-1 mb-1">
            <Gift className="h-3 w-3 text-emerald-400" />
            <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400">
              Instant cash
            </p>
          </div>
          <p className="text-lg font-bold tabular-nums text-foreground leading-tight">
            ₦{referralCashBonus.toLocaleString()}
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
            To your withdrawable wallet
          </p>
        </div>
        {showBatchTile && (
          <div className="rounded-2xl border border-primary/25 bg-primary/[0.08] p-3">
            <div className="flex items-center gap-1 mb-1">
              <TimerReset className="h-3 w-3 text-primary" />
              <p className="text-[9px] font-semibold uppercase tracking-wider text-primary">
                Today
              </p>
            </div>
            <p className="text-lg font-bold tabular-nums text-foreground leading-tight">
              +{bonusBatches}
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
              {bonusBatches === 1 ? 'extra rating session' : 'extra rating sessions'}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-1 pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          How you earn from each friend
        </p>
      </div>

      {/* Always-visible first card — pending jump */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 mb-1">
          The moment they activate
        </p>
        <p className="text-[13px] text-foreground leading-snug">
          <span className="font-bold tabular-nums text-amber-400">
            ₦{referralPendingBonus.toLocaleString()}
          </span>{' '}
          pops instantly into your pending balance and{' '}
          <span className="font-bold tabular-nums text-emerald-400">
            ₦{referralCashBonus.toLocaleString()}
          </span>{' '}
          hits your withdrawable wallet — the second your friend joins.
        </p>
      </div>

      {/* Collapsible — only meaningful when there are extra batches to unlock */}
      {showBatchTile && (
        <>
          <div
            className={cn(
              'grid transition-all duration-300 ease-out',
              open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
            )}
          >
            <div className="overflow-hidden">
              <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-1">
                  More daily room today
                </p>
                <p className="text-[13px] text-foreground leading-snug">
                  Each friend who joins also unlocks{' '}
                  <span className="font-semibold tabular-nums">
                    +{bonusBatches} {bonusBatches === 1 ? 'rating session' : 'rating sessions'}
                  </span>{' '}
                  in your daily picture rating today
                  {nairaPerBatch > 0 && (
                    <>
                      {' '}— that's about{' '}
                      <span className="font-bold tabular-nums text-emerald-400">
                        ₦{extraEarnings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>{' '}
                      more in your pocket today, per friend
                    </>
                  )}
                  .
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border/50 bg-card hover:bg-muted/40 transition-colors"
            aria-expanded={open}
          >
            <span className="text-[12px] font-semibold text-foreground">
              {open ? 'Show less' : 'Show 1 more way you earn'}
            </span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
                open && 'rotate-180',
              )}
            />
          </button>
        </>
      )}
    </div>
  );
};
