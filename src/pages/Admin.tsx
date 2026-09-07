import { useAdminDashboardAnalytics } from '@/hooks/useAdminDashboardAnalytics';
import { OverviewCards } from '@/components/admin/OverviewCards';
import { PlatformStatusSummary } from '@/components/admin/PlatformStatusSummary';
import {
  ViketaLineOverview,
  QueueHealthCard,
  UserGrowthChart,
  TopPerformersCard,
  QuickInsightsCard,
  RecentActivityFeed,
} from '@/components/admin/dashboard';
import { Shield, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fmtTimeAgo } from '@/lib/formatLagos';

const lagosClockFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Lagos',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
import { useState, useEffect } from 'react';

export default function Admin() {
  // No global time range — every panel is fully independent.
  // The analytics hook still needs a window for top performers/insights — use 30d as a stable default.
  const { data: analytics, isLoading, refetch, dataUpdatedAt } = useAdminDashboardAnalytics(30);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const lastUpdated = dataUpdatedAt ? fmtTimeAgo(new Date(dataUpdatedAt)) : null;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="h-5 w-5 md:h-6 md:w-6 text-primary shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold leading-tight truncate">Control Room</h1>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              Lagos · {lagosClockFmt.format(now)}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="h-8 w-8 p-0"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          {lastUpdated && (
            <span className="text-[10px] text-muted-foreground">
              Updated {lastUpdated}
            </span>
          )}
        </div>
      </div>

      {/* Platform Status Summary */}
      <PlatformStatusSummary
        dropSystemActive={analytics?.status.dropSystemActive ?? true}
        distributionActive={analytics?.status.distributionActive ?? true}
        maintenanceMode={analytics?.status.maintenanceMode ?? false}
        withdrawalsEnabled={analytics?.status.withdrawalsEnabled ?? true}
        isLoading={isLoading}
      />

      {/* Viketa Line Overview - 4 Key Stats */}
      <ViketaLineOverview
        activeSpots={analytics?.overview.activeSpots ?? 0}
        dropsInQueue={analytics?.overview.dropsInQueue ?? 0}
        totalCycles={analytics?.overview.totalCycles ?? 0}
        todayPayouts={analytics?.todayStats.totalPayouts ?? 0}
        todayDistributed={analytics?.todayStats.totalDistributed ?? 0}
        isLoading={isLoading}
      />

      {/* Overview Cards - Users & Members */}
      <OverviewCards
        totalUsers={analytics?.overview.totalUsers || 0}
        totalMembers={analytics?.overview.totalMembers || 0}
        totalUserBalances={analytics?.overview.totalUserBalances || 0}
        isLoading={isLoading}
      />

      {/* User Growth — fully independent (own date filter, own data) */}
      <UserGrowthChart />

      {/* Info Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <QueueHealthCard
          totalInQueue={analytics?.queue.totalInQueue ?? 0}
          nextPayoutPosition={analytics?.queue.nextPayoutPosition ?? 0}
          averageFillPercent={analytics?.queue.averageFillPercent ?? 0}
          estimatedPayoutTime={analytics?.queue.estimatedPayoutTime ?? 0}
          lastPulseTime={analytics?.status.lastPulseTime ?? null}
          pulseIntervalSeconds={analytics?.status.pulseIntervalSeconds ?? 60}
          isLoading={isLoading}
        />
        <TopPerformersCard
          referrers={analytics?.topPerformers.referrers || []}
          cyclers={analytics?.topPerformers.cyclers || []}
          isLoading={isLoading}
        />
      </div>

      {/* Quick Insights */}
      <QuickInsightsCard
        insights={analytics?.insights || []}
        isLoading={isLoading}
      />

      {/* Recent Activity */}
      <RecentActivityFeed
        activities={analytics?.recentActivity || []}
        isLoading={isLoading}
      />
    </div>
  );
}
