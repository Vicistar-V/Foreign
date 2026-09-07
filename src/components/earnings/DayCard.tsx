import { motion } from 'framer-motion';
import { Calendar, Users, Cpu } from 'lucide-react';
import { PeopleCarousel } from './PeopleCarousel';
import { MachinesList } from './MachinesList';
import { DayStatsBar } from './DayStatsBar';
import { DayData } from '@/hooks/useEarningsTimeline';
import { cn } from '@/lib/utils';
import { formatNigerianDate } from '@/lib/nigerianTime';

interface DayCardProps {
  day: DayData;
  index?: number;
  isToday?: boolean;
}

export const DayCard = ({ day, index = 0, isToday }: DayCardProps) => {
  return (
    <motion.div
      className={cn(
        "rounded-2xl border bg-card overflow-hidden",
        isToday && "border-primary/30"
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
    >
      {/* Date Header */}
      <div className={cn(
        "flex items-center gap-2 p-4 pb-3",
        isToday && "bg-primary/5"
      )}>
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center",
          isToday ? "bg-primary/20" : "bg-muted"
        )}>
          <Calendar className={cn(
            "w-4 h-4",
            isToday ? "text-primary" : "text-muted-foreground"
          )} />
        </div>
        <div>
          <h3 className={cn(
            "font-semibold text-sm",
            isToday ? "text-primary" : "text-foreground"
          )}>
            {day.label}
          </h3>
          {!isToday && (
            <p className="text-[10px] text-muted-foreground">
              {formatNigerianDate(day.date + 'T12:00:00')}
            </p>
          )}
        </div>
        
        {isToday && (
          <span className="ml-auto text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium animate-pulse">
            LIVE
          </span>
        )}
      </div>

      {/* Section 1: People Who Earned */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            People Who Earned
          </span>
        </div>
        <PeopleCarousel earners={day.unique_earners} />
      </div>

      {/* Section 2: Spots That Worked */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Ad Shares That Finished
          </span>
        </div>
        <MachinesList 
          spots={day.spots} 
          hasMore={day.has_more_spots}
        />
      </div>

      {/* Stats Footer */}
      <div className="px-4 pb-4">
        <DayStatsBar stats={day.stats} />
      </div>
    </motion.div>
  );
};
