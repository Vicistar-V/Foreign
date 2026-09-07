import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Clock, Users, Zap } from 'lucide-react';
import { fmtTimeAgo } from '@/lib/formatLagos';

interface QueueHealthCardProps {
  totalInQueue: number;
  nextPayoutPosition: number;
  averageFillPercent: number;
  estimatedPayoutTime: number;
  lastPulseTime: string | null;
  pulseIntervalSeconds: number;
  isLoading?: boolean;
}

export function QueueHealthCard({
  totalInQueue,
  nextPayoutPosition,
  averageFillPercent,
  estimatedPayoutTime,
  lastPulseTime,
  pulseIntervalSeconds,
  isLoading = false,
}: QueueHealthCardProps) {
  if (isLoading) {
    return (
      <Card className="bg-card/50">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  const formatEstimatedTime = (seconds: number) => {
    if (seconds <= 0) return 'Soon';
    if (seconds < 60) return `~${seconds}s`;
    if (seconds < 3600) return `~${Math.ceil(seconds / 60)}m`;
    return `~${Math.ceil(seconds / 3600)}h`;
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Queue Health
          </CardTitle>
          <Badge variant="outline" className="text-xs tabular-nums">
            <Zap className="h-3 w-3 mr-1" />
            {lastPulseTime ? fmtTimeAgo(lastPulseTime) : 'Never'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Queue Progress */}
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Next drop progress</span>
            <span className="tabular-nums">{Math.round(averageFillPercent)}%</span>
          </div>
          <Progress value={averageFillPercent} className="h-2" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-muted/30 rounded-lg p-2.5">
            <p className="text-muted-foreground text-xs">Queue Size</p>
            <p className="font-semibold tabular-nums">{totalInQueue}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-2.5">
            <p className="text-muted-foreground text-xs">Next Payout</p>
            <p className="font-semibold tabular-nums">#{nextPayoutPosition}</p>
          </div>
        </div>

        {/* Estimated Time */}
        <div className="flex items-center justify-between text-xs bg-muted/20 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Next payout in</span>
          </div>
          <span className="font-medium tabular-nums">{formatEstimatedTime(estimatedPayoutTime)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
