import { Spot } from '@/hooks/useDropStatus';
import { cn } from '@/lib/utils';

interface SpotCircleProps {
  spot: Spot;
  index: number;
  onClick: () => void;
}

/**
 * A small circular spot indicator for the horizontal carousel.
 *
 * Empire mode: every spot on a user shares ONE drop, so instead of drawing
 * N identical progress rings, each circle simply advertises which spot number
 * it is + whether it's an extension (+1 badge) that grew the shared ticket.
 * The unified progress bar lives above the carousel in MachinesCard.
 */
export function SpotCircle({ spot, index, onClick }: SpotCircleProps) {
  const drop = spot.current_drop;
  const status = drop?.status ?? 'waiting';
  const isExtension = spot.is_extension === true;

  const tone = (() => {
    switch (status) {
      case 'filling':
        return { ring: 'border-amber-500/40', dot: 'bg-amber-500', label: 'Earning' };
      case 'completed':
      case 'paid':
        return { ring: 'border-emerald-500/40', dot: 'bg-emerald-500', label: 'Paid' };
      case 'pending_redrop':
        return { ring: 'border-primary/40', dot: 'bg-primary', label: 'Restarting' };
      default:
        return { ring: 'border-border', dot: 'bg-muted-foreground', label: 'Waiting' };
    }
  })();

  return (
    <button
      type="button"
      onClick={onClick}
      className="snap-start shrink-0 flex flex-col items-center gap-1.5 w-[68px] active:scale-95 transition-transform"
      aria-label={`Share ${index + 1}, ${tone.label}${isExtension ? ', extension' : ''}`}
    >
      <div className="relative">
        <div
          className={cn(
            'h-14 w-14 rounded-full border-2 bg-card flex flex-col items-center justify-center',
            tone.ring
          )}
        >
          <span className="text-[13px] font-bold text-foreground leading-none">
            {index + 1}
          </span>
          <span className="text-[8.5px] font-medium text-muted-foreground tabular-nums leading-none mt-0.5">
            {spot.total_cycles}×
          </span>
        </div>
        {/* Status dot */}
        <span
          className={cn(
            'absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-background',
            tone.dot
          )}
        />
        {/* Extension badge — subtle "+1" chip so users see which spots grew the line */}
        {isExtension && (
          <span className="absolute -bottom-0.5 -left-0.5 h-4 min-w-4 px-1 rounded-full ring-2 ring-background bg-emerald-500 text-[8px] font-bold text-white flex items-center justify-center">
            +1
          </span>
        )}
      </div>
      <span className="text-[10px] font-medium text-muted-foreground truncate max-w-[64px]">
        {isExtension ? 'Extra' : tone.label}
      </span>
    </button>
  );
}
