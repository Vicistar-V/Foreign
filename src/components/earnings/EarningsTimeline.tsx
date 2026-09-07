import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { DayCard } from './DayCard';
import { DayData } from '@/hooks/useEarningsTimeline';
import { TrendingUp, Zap, Clock } from 'lucide-react';

interface EarningsTimelineProps {
  days: DayData[];
  isLoading?: boolean;
}

export const EarningsTimeline = ({ days, isLoading }: EarningsTimelineProps) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <motion.div
        className="rounded-2xl border bg-card p-8 text-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
          <Clock className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-foreground mb-2">No Payouts Yet</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Campaigns are just warming up. Be the first to activate a share!
        </p>
      </motion.div>
    );
  }

  // Check if first day is today
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-4">
      {days.map((day, index) => (
        <DayCard
          key={day.date}
          day={day}
          index={index}
          isToday={day.date === today}
        />
      ))}
    </div>
  );
};
