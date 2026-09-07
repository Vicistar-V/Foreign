import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Layers, TrendingUp, Wallet } from 'lucide-react';

interface ViketaLineOverviewProps {
  activeSpots: number;
  dropsInQueue: number;
  totalCycles: number;
  todayPayouts: number;
  todayDistributed: number;
  isLoading?: boolean;
}

export function ViketaLineOverview({
  activeSpots,
  dropsInQueue,
  totalCycles,
  todayPayouts,
  todayDistributed,
  isLoading = false,
}: ViketaLineOverviewProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-card/50">
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: 'Active Spots',
      value: activeSpots.toLocaleString(),
      icon: Layers,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
    {
      label: 'In Queue',
      value: dropsInQueue.toLocaleString(),
      icon: Users,
      color: 'text-accent-orange',
      bgColor: 'bg-accent-orange/10',
    },
    {
      label: 'Total Cycles',
      value: totalCycles.toLocaleString(),
      icon: TrendingUp,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      label: 'Paid Today',
      value: `₦${todayDistributed.toLocaleString()}`,
      subValue: `${todayPayouts} payouts`,
      icon: Wallet,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label} className="bg-card/50 border-border/50">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-md ${stat.bgColor}`}>
                <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
              </div>
              <span className="text-xs text-muted-foreground truncate">{stat.label}</span>
            </div>
            <p className="text-xl font-bold tabular-nums">{stat.value}</p>
            {stat.subValue && (
              <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">{stat.subValue}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
