import { motion } from 'framer-motion';
import { Zap, TrendingUp, Clock } from 'lucide-react';
import { GlobalStats } from '@/hooks/useEarningsTimeline';
import { Skeleton } from '@/components/ui/skeleton';

interface GlobalStatsBarProps {
  stats?: GlobalStats;
  isLoading?: boolean;
}

export const GlobalStatsBar = ({ stats, isLoading }: GlobalStatsBarProps) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  const items = [
    {
      label: "All Time",
      value: stats?.all_time_cycles || 0,
      suffix: "campaigns",
      icon: Zap,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      label: "Distributed",
      value: `₦${((stats?.all_time_distributed || 0) / 1000).toFixed(0)}k`,
      suffix: "",
      icon: TrendingUp,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Today",
      value: stats?.today_cycles || 0,
      suffix: "campaigns",
      icon: Clock,
      color: "text-primary",
      bg: "bg-primary/10",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((item, index) => (
        <motion.div
          key={item.label}
          className="rounded-xl bg-card border p-3 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <div className={`w-7 h-7 rounded-lg ${item.bg} mx-auto mb-1.5 flex items-center justify-center`}>
            <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
          </div>
          <div className="text-sm font-bold text-foreground">
            {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {item.suffix ? `${item.suffix}` : item.label}
          </div>
        </motion.div>
      ))}
    </div>
  );
};
