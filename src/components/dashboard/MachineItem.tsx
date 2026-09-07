import { ChevronRight, Loader2, CheckCircle2, RefreshCw, Clock } from 'lucide-react';
import { Spot } from '@/hooks/useDropStatus';
import { cn } from '@/lib/utils';

interface MachineItemProps {
  spot: Spot;
  index: number;
  profitAmount: number;
  onClick: () => void;
}

// Simple, premium spot row.
// One spot = one earning slot that fills, pays you, and auto-restarts.
export function MachineItem({ spot, index, profitAmount, onClick }: MachineItemProps) {
  const drop = spot.current_drop;
  const fill = Math.min(100, Math.max(0, drop?.fill_percentage || 0));
  const status = drop?.status ?? 'waiting';

  const statusMeta = (() => {
    switch (status) {
      case 'filling':
        return { label: 'Earning', icon: Loader2, tone: 'text-amber-500', dotBg: 'bg-amber-500', barBg: 'bg-amber-500' };
      case 'completed':
        return { label: 'Ready to pay', icon: CheckCircle2, tone: 'text-emerald-500', dotBg: 'bg-emerald-500', barBg: 'bg-emerald-500' };
      case 'paid':
        return { label: 'Paid', icon: CheckCircle2, tone: 'text-emerald-500', dotBg: 'bg-emerald-500', barBg: 'bg-emerald-500' };
      case 'pending_redrop':
        return { label: 'Restarting', icon: RefreshCw, tone: 'text-primary', dotBg: 'bg-primary', barBg: 'bg-primary' };
      default:
        return { label: 'Getting ready', icon: Clock, tone: 'text-muted-foreground', dotBg: 'bg-muted-foreground', barBg: 'bg-muted-foreground/60' };
    }
  })();

  const StatusIcon = statusMeta.icon;
  const isFilling = status === 'filling';
  const isRestart = status === 'pending_redrop';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-border/60 bg-card/40 hover:bg-card/70 transition-colors p-4 active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground truncate">
              Share {index + 1}
            </span>
            <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium', statusMeta.tone)}>
              <span className="relative flex h-1.5 w-1.5">
                {isFilling && (
                  <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping', statusMeta.dotBg)} />
                )}
                <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', statusMeta.dotBg)} />
              </span>
              {statusMeta.label}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Pays <span className="font-semibold text-foreground tabular-nums">₦{profitAmount.toLocaleString()}</span> each campaign • {spot.total_cycles} done
          </p>
        </div>

        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-emerald-500 tabular-nums">
            +₦{spot.total_earnings.toLocaleString()}
          </p>
          <p className="text-[10px] text-muted-foreground">earned</p>
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>

      {/* Slim progress bar */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', statusMeta.barBg)}
            style={{ width: isRestart ? '100%' : `${fill}%` }}
          />
        </div>
        <span className="text-[11px] font-medium tabular-nums text-muted-foreground w-9 text-right">
          {isRestart ? '—' : `${Math.round(fill)}%`}
        </span>
        <StatusIcon className={cn('h-3.5 w-3.5', statusMeta.tone, isFilling && 'animate-spin', isRestart && 'animate-spin')} />
      </div>
    </button>
  );
}
