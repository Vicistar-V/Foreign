import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Lightbulb, TrendingDown, TrendingUp, Users, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickInsightsCardProps {
  insights: string[];
  isLoading?: boolean;
}

export function QuickInsightsCard({ insights, isLoading }: QuickInsightsCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  // Helper to get icon based on insight content
  const getInsightIcon = (insight: string) => {
    if (insight.toLowerCase().includes('down')) return TrendingDown;
    if (insight.toLowerCase().includes('up')) return TrendingUp;
    if (insight.toLowerCase().includes('user') || insight.toLowerCase().includes('member')) return Users;
    if (insight.toLowerCase().includes('peak') || insight.toLowerCase().includes('activity')) return Clock;
    if (insight.toLowerCase().includes('subsidy') || insight.toLowerCase().includes('pending')) return AlertTriangle;
    return Lightbulb;
  };

  // Helper to get color based on insight content
  const getInsightColor = (insight: string) => {
    if (insight.toLowerCase().includes('down') || insight.toLowerCase().includes('deficit')) {
      return 'text-destructive';
    }
    if (insight.toLowerCase().includes('up') || insight.toLowerCase().includes('new')) {
      return 'text-accent-green';
    }
    if (insight.toLowerCase().includes('subsidy') || insight.toLowerCase().includes('pending')) {
      return 'text-accent-orange';
    }
    return 'text-muted-foreground';
  };

  if (insights.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Quick Insights</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-2">
            No insights available yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-medium">Quick Insights</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {insights.map((insight, index) => {
            const Icon = getInsightIcon(insight);
            const colorClass = getInsightColor(insight);
            
            return (
              <li
                key={index}
                className="flex items-start gap-2 text-sm"
              >
                <Icon className={cn("h-3.5 w-3.5 mt-0.5 flex-shrink-0", colorClass)} />
                <span className="text-foreground">{insight}</span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
