import { Gift, TimerReset } from 'lucide-react';

interface ReferrerPitchProps {
  bonusBatches: number;
  referralCashBonus: number;
  nairaPerBatch: number;
}

/**
 * Retirement Economy referral pitch.
 * The ONLY referral reward is the instant ₦X cash paid when a friend
 * activates — there are no recurring per-cycle royalties anymore.
 */
export const ReferrerPitch = ({
  bonusBatches,
  referralCashBonus,
  nairaPerBatch,
}: ReferrerPitchProps) => {
  const extraEarnings = bonusBatches * nairaPerBatch;

  return (
    <div className="space-y-4">
      {/* Pitch paragraph */}
      <div className="px-1">
        <p className="text-[15px] text-foreground leading-snug">
          Invite <span className="font-semibold">your friends</span> to unlock{' '}
          <span className="font-semibold tabular-nums">
            +{bonusBatches} {bonusBatches === 1 ? 'rating session' : 'rating sessions'}
          </span>{' '}
          per friend today — and the moment each one activates, you instantly get{' '}
          <span className="text-emerald-400 font-bold tabular-nums bg-emerald-500/10 px-1.5 py-0.5 rounded">
            ₦{referralCashBonus.toLocaleString()}
          </span>{' '}
          straight into your withdrawal wallet.
        </p>
        <p className="text-[13px] text-muted-foreground leading-snug mt-2">
          One friend, one instant cash bonus — no waiting, no complicated math.
        </p>
      </div>

      {/* 2 reward tiles */}
      <div className="grid grid-cols-2 gap-2">
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
            When your friend activates
          </p>
        </div>
        <div className="rounded-2xl border border-primary/25 bg-primary/[0.08] p-3">
          <div className="flex items-center gap-1 mb-1">
            <TimerReset className="h-3 w-3 text-primary" />
            <p className="text-[9px] font-semibold uppercase tracking-wider text-primary">
              Today's boost
            </p>
          </div>
          <p className="text-lg font-bold tabular-nums text-foreground leading-tight">
            +{bonusBatches}
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
            {bonusBatches === 1 ? 'extra rating session' : 'extra rating sessions'}
          </p>
        </div>
      </div>

      {nairaPerBatch > 0 && (
        <div className="rounded-2xl border border-border/40 bg-muted/20 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Bonus: more daily room
          </p>
          <p className="text-sm text-foreground leading-snug">
            Each extra rating session pays{' '}
            <span className="font-bold tabular-nums text-emerald-400">
              ₦{nairaPerBatch.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {extraEarnings > 0 && (
              <>
                , so {bonusBatches} extra {bonusBatches === 1 ? 'rating session' : 'rating sessions'} from one friend ≈{' '}
                <span className="font-bold tabular-nums text-foreground">
                  ₦{extraEarnings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>{' '}
                more today
              </>
            )}
            .
          </p>
        </div>
      )}
    </div>
  );
};
