import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Zap, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useEffect, useRef } from 'react';
import { haptics } from '@/lib/haptics';

interface SpotDrop {
  status: string;
  position: number;
  fill_amount: number;
  target_amount: number;
}
interface SpotLike {
  drops?: SpotDrop[] | { status: string; position: number; fill_amount: number; target_amount: number }[];
}

interface HarvestUrgencyStripProps {
  spots: SpotLike[] | undefined;
  pendingBalance: number;
  profitTarget: number;
  isMember: boolean;
}

// RED nudge only when the user is LITERALLY next in line (position === 1) AND
// their pending balance can't cover the full profit target. AMBER only when
// they're close to the front (position <= 3) and short. Otherwise silent — no
// false alarms for users deep in the queue.
export function HarvestUrgencyStrip({
  spots,
  pendingBalance,
  profitTarget,
  isMember,
}: HarvestUrgencyStripProps) {
  const navigate = useNavigate();
  const hapticFired = useRef(false);

  const allDrops = (spots ?? [])
    .flatMap(s => (Array.isArray(s.drops) ? s.drops : []))
    .filter((d): d is SpotDrop => !!d && typeof d.position === 'number');

  // Only drops still in the queue (filling/waiting), earliest first.
  const earliest = allDrops
    .filter(d => d.status === 'filling' || d.status === 'waiting')
    .sort((a, b) => a.position - b.position)[0];

  // Use the earliest drop's OWN target — reflects the user's real upcoming
  // payout (empire/extend model means it can be ₦10k, ₦20k, ₦30k, …).
  const perSpotTarget = earliest?.target_amount ?? profitTarget;
  const pending = Math.max(0, pendingBalance || 0);
  const shortfall = Math.max(0, perSpotTarget - pending);
  const position = earliest?.position ?? 0;

  const fillPercent = earliest
    ? Math.min(100, Math.max(0, (earliest.fill_amount / earliest.target_amount) * 100))
    : 0;

  // "Next in line" = the drop is actually about to pay out (near-full),
  // not just position 1. A brand-new drop at 8% full is NOT imminent.
  const isNext = position === 1 && fillPercent >= 85;
  const isNear = fillPercent >= 60 && fillPercent < 85;

  const isRed = !!earliest && isNext && shortfall > 0;

  useEffect(() => {
    if (isRed && !hapticFired.current) {
      haptics.medium();
      hapticFired.current = true;
    }
    if (!isRed) hapticFired.current = false;
  }, [isRed]);

  if (!isMember || !earliest) return null;

  // RED — user is next and pending balance is short.
  if (isRed) {
    return (
      <div className="rounded-2xl border-2 border-destructive bg-destructive/10 p-4 shadow-lg shadow-destructive/10 animate-pulse">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-destructive/20 p-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-destructive uppercase tracking-wide">
              Your campaign is about to finish
            </p>
            <p className="text-sm text-foreground mt-1 leading-snug">
              Your pending balance only has <span className="font-bold tabular-nums">₦{pending.toLocaleString()}</span>.
              When your turn hits you'll only collect{' '}
              <span className="font-bold tabular-nums">₦{pending.toLocaleString()}</span> instead of{' '}
              <span className="font-bold tabular-nums">₦{perSpotTarget.toLocaleString()}</span>.

            </p>
            <p className="text-xs text-muted-foreground mt-1 tabular-nums">
              Your campaign is {Math.round(fillPercent)}% done
            </p>
            <Button
              size="sm"
              variant="destructive"
              className="mt-3 w-full sm:w-auto font-bold"
              onClick={() => navigate('/task')}
            >
              <Zap className="h-4 w-4 mr-1.5" />
              Do tasks now — top up ₦{shortfall.toLocaleString()}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // AMBER — near the front (2nd or 3rd) and short.
  if (isNear && shortfall > 0) {
    return (
      <button
        type="button"
        onClick={() => navigate('/task')}
        className={cn(
          'w-full text-left rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 active:scale-[0.99] transition-transform'
        )}
      >
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-amber-500/20 p-1.5 shrink-0">
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Your campaign is close to done — top up your pending balance
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
              You have <span className="font-semibold text-foreground tabular-nums">₦{pending.toLocaleString()}</span> ready.
              When your turn hits you'll only collect what's in your pending balance — top up{' '}
              <span className="font-semibold text-amber-500 tabular-nums">₦{shortfall.toLocaleString()}</span> in tasks.
            </p>
          </div>
        </div>
      </button>
    );
  }

  // Silent when fully funded or when there's nothing urgent to say.
  return null;

}
