import { Card, CardContent } from '@/components/ui/card';
import { ArrowUpRight, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { FlutterwaveSummary, formatNaira } from '@/hooks/useFlutterwaveData';
import { Skeleton } from '@/components/ui/skeleton';

interface FlutterwaveQuickStatsProps {
  summary: FlutterwaveSummary | undefined;
  isLoading: boolean;
}

export const FlutterwaveQuickStats = ({ summary, isLoading }: FlutterwaveQuickStatsProps) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const stats = [
    {
      label: 'Processing',
      count: summary.totalPending,
      amount: summary.totalPendingAmount,
      icon: Clock,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      label: 'Completed',
      count: summary.totalSuccessful,
      amount: summary.totalSuccessfulAmount,
      icon: CheckCircle2,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      label: 'Problems',
      count: summary.totalFailed,
      amount: summary.totalFailedAmount,
      icon: XCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
    {
      label: 'Received',
      count: summary.totalDepositsSuccessful,
      amount: summary.totalDepositsAmount,
      icon: ArrowUpRight,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-border/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className={`p-1.5 rounded-md ${stat.bgColor}`}>
                <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
              </div>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-lg font-bold">{stat.count}</p>
            <p className="text-xs text-muted-foreground truncate">
              {formatNaira(stat.amount)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
