import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Spot } from '@/hooks/useDropStatus';
import {
  X,
  RefreshCw,
  Banknote,
  CheckCircle2,
  Loader2,
  Clock,
  Calendar,
  Layers,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface SpotDetailDrawerProps {
  spot: Spot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: {
    entry_fee: number;
    target_amount: number;
    profit_amount: number;
  };
}

export function SpotDetailDrawer({ spot, open, onOpenChange, config }: SpotDetailDrawerProps) {
  if (!spot) return null;

  // Empire mode: every spot on a user references the SAME shared drop, so
  // the numbers shown here describe the user's whole line (position, fill,
  // target payout), not this individual spot in isolation.
  const drop = spot.current_drop;
  const fill = Math.min(100, Math.max(0, drop?.fill_percentage || 0));
  const status = drop?.status ?? 'waiting';
  const isExtension = spot.is_extension === true;

  const entryFee = config?.entry_fee || 5000;
  const targetAmount = drop?.target_amount || config?.target_amount || 10000;
  const filledAmount = drop?.fill_amount || 0;

  const meta = (() => {
    switch (status) {
      case 'filling':
        return { label: 'Earning', tone: 'text-amber-500', dot: 'bg-amber-500', bar: 'bg-amber-500', Icon: Loader2 };
      case 'completed':
        return { label: 'Ready to pay', tone: 'text-emerald-500', dot: 'bg-emerald-500', bar: 'bg-emerald-500', Icon: CheckCircle2 };
      case 'paid':
        return { label: 'Paid', tone: 'text-emerald-500', dot: 'bg-emerald-500', bar: 'bg-emerald-500', Icon: CheckCircle2 };
      case 'pending_redrop':
        return { label: 'Restarting', tone: 'text-primary', dot: 'bg-primary', bar: 'bg-primary', Icon: RefreshCw };
      default:
        return { label: 'Getting ready', tone: 'text-muted-foreground', dot: 'bg-muted-foreground', bar: 'bg-muted-foreground/60', Icon: Clock };
    }
  })();

  const isFilling = status === 'filling';
  const isRestart = status === 'pending_redrop';
  const StatusIcon = meta.Icon;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88vh] overflow-hidden">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Close */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3 p-2 rounded-full hover:bg-muted transition-colors z-10"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        <div className="px-5 pb-7 overflow-y-auto">
          {/* ── Title ───────────────────────────────────── */}
          <div className="pt-1 pb-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Share detail</p>
            <div className="flex items-center gap-2 mt-0.5">
              <h2 className="text-xl font-bold text-foreground">{spot.spot_name}</h2>
              {isExtension && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 uppercase tracking-wider">
                  Extension
                </span>
              )}
            </div>
            <div className={cn('inline-flex items-center gap-1.5 mt-2 text-xs font-medium', meta.tone)}>
              <span className="relative flex h-1.5 w-1.5">
                {isFilling && (
                  <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping', meta.dot)} />
                )}
                <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', meta.dot)} />
              </span>
              {meta.label}
              <StatusIcon className={cn('h-3.5 w-3.5', (isFilling || isRestart) && 'animate-spin')} />
            </div>
          </div>

          {/* ── Whole-line progress (shared across every spot) ─── */}
          {!isRestart && (
            <div className="rounded-2xl border border-border/60 bg-card/40 p-4 mb-3">
              <div className="flex items-baseline justify-between">
                <p className="text-3xl font-bold text-foreground tabular-nums">{Math.round(fill)}%</p>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Campaign progress</p>
              </div>
              <div className="mt-3 h-2 rounded-full bg-muted/50 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', meta.bar)}
                  style={{ width: `${fill}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[12px] text-muted-foreground tabular-nums">
                <span>₦{filledAmount.toLocaleString()}</span>
                <span>₦{targetAmount.toLocaleString()}</span>
              </div>
              <p className="mt-2 text-[10.5px] text-muted-foreground leading-snug flex items-start gap-1.5">
                <Layers className="h-3 w-3 mt-0.5 shrink-0" />
                All your shares follow this campaign. When it hits 100%, they pay out at once.
              </p>
            </div>
          )}

          {isRestart && (
            <div className="rounded-2xl border border-border/60 bg-card/40 p-6 mb-3 flex flex-col items-center text-center">
              <RefreshCw className="h-7 w-7 text-primary animate-spin mb-2" />
              <p className="text-sm font-semibold text-foreground">Restarting your campaign</p>
              <p className="text-xs text-muted-foreground mt-1">It just paid you and is queueing up again.</p>
            </div>
          )}

          {/* ── Outcome card: what the whole line pays ─────── */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/15">
                <Banknote className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  Your campaign pays out
                </p>
                <p className="text-2xl font-bold text-emerald-500 tabular-nums leading-tight">
                  ₦{targetAmount.toLocaleString()}
                </p>
                <p className="text-[10.5px] text-muted-foreground mt-0.5 leading-snug">
                  Split across every share you own — then all shares finish together.
                </p>
              </div>
            </div>
          </div>

          {/* ── Lifetime stats ─────────────────────────── */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-2xl border border-border/60 bg-card/40 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Earned so far</p>
              <p className="text-lg font-bold text-emerald-500 tabular-nums mt-0.5">
                +₦{spot.total_earnings.toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/40 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Payouts done</p>
              <p className="text-lg font-bold text-foreground tabular-nums mt-0.5">
                {spot.total_cycles}
              </p>
            </div>
          </div>

          {/* ── Footer info ─────────────────────────────── */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1 pt-1">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Opened {format(new Date(spot.created_at), 'MMM d, yyyy')}
            </span>
            {null}
          </div>

          {/* ── Locked principal note ───────────────────── */}
          <p className="text-[11px] text-muted-foreground text-center mt-4 px-2">
            Your <span className="text-foreground font-medium tabular-nums">₦{entryFee.toLocaleString()}</span> entry stays locked in your share until it pays out.
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

