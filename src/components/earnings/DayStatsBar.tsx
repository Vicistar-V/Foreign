import { Zap, TrendingUp, Users } from 'lucide-react';
import { DayStats } from '@/hooks/useEarningsTimeline';

interface DayStatsBarProps {
  stats: DayStats;
}

export const DayStatsBar = ({ stats }: DayStatsBarProps) => {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-3 border-t border-border/50">
      <div className="flex items-center gap-1">
        <Zap className="w-3 h-3 text-amber-500" />
        <span>{stats.total_cycles} campaigns paid</span>
      </div>
      
      <div className="flex items-center gap-1">
        <TrendingUp className="w-3 h-3 text-emerald-500" />
        <span>₦{stats.total_distributed.toLocaleString()}</span>
      </div>
      
      <div className="flex items-center gap-1">
        <Users className="w-3 h-3 text-primary" />
        <span>{stats.unique_earners_count} earners</span>
      </div>
    </div>
  );
};
