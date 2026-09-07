import { motion } from 'framer-motion';
import { Cpu, ArrowRight } from 'lucide-react';
import { SpotEntry } from '@/hooks/useEarningsTimeline';
import { cn } from '@/lib/utils';
import { formatNigerianRelativeTime } from '@/lib/nigerianTime';

interface MachineCardProps {
  spot: SpotEntry;
  isOwner?: boolean;
  index?: number;
  onTap?: () => void;
}

export const MachineCard = ({ spot, isOwner, index = 0, onTap }: MachineCardProps) => {
  const timeAgo = formatNigerianRelativeTime(spot.last_cycle_at);
  const cycleText = spot.cycles_today === 1 ? '1 payout today' : `${spot.cycles_today} payouts today`;

  return (
    <motion.button
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl border bg-card transition-colors text-left",
        isOwner ? "border-primary/30 bg-primary/5" : "border-border/50",
        "hover:bg-accent/50 active:bg-accent"
      )}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      onClick={onTap}
      whileTap={{ scale: 0.98 }}
    >
      {/* Spot Icon */}
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
        isOwner ? "bg-primary/20" : "bg-muted"
      )}>
        <Cpu className={cn(
          "w-5 h-5",
          isOwner ? "text-primary" : "text-muted-foreground"
        )} />
      </div>

      {/* Spot Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">
            {spot.spot_name}
          </span>
          {isOwner && (
            <span className="text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-medium shrink-0">
              YOURS
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {cycleText} • {timeAgo}
        </p>
      </div>

      {/* Amount */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="font-bold text-sm text-emerald-500">
          +₦{spot.total_earned_today.toLocaleString()}
        </span>
        <ArrowRight className="w-3 h-3 text-muted-foreground" />
      </div>
    </motion.button>
  );
};

// Using formatNigerianRelativeTime from @/lib/nigerianTime instead of custom function
