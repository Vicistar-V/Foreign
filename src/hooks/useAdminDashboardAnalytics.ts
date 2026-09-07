import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Inline replacement for the deleted global TimeRangeSelector types
type TimeRangeValue = 1 | 7 | 14 | 30 | 90 | 'all' | 'custom';
interface CustomDateRange {
  startDate?: Date;
  endDate?: Date;
}

// Viketa Line Analytics Interface
export interface AdminDashboardAnalytics {
  overview: {
    totalUsers: number;
    totalMembers: number;
    activeSpots: number;
    dropsInQueue: number;
    totalCycles: number;
    totalProfitDistributed: number;
    totalUserBalances: number;
    pendingWithdrawals: number;
    pendingWithdrawalsAmount: number;
  };
  status: {
    dropSystemActive: boolean;
    distributionActive: boolean;
    maintenanceMode: boolean;
    withdrawalsEnabled: boolean;
    lastPulseTime: string | null;
    pulseIntervalSeconds: number;
  };
  queue: {
    totalInQueue: number;
    nextPayoutPosition: number;
    averageFillPercent: number;
    estimatedPayoutTime: number;
    totalSpots: number;
    totalDrops: number;
  };
  charts: {
    spotPurchases: Array<{ date: string; count: number }>;
    userGrowth: Array<{ date: string; signups: number; members: number }>;
  };
  pulseHistory: Array<{
    pulseNumber: number;
    timestamp: string;
    newDrops: number;
    reEntries: number;
    payouts: number;
    distributed: number;
    status: string;
  }>;
  todayStats: {
    totalPulses: number;
    totalPayouts: number;
    totalDistributed: number;
  };
  topPerformers: {
    referrers: Array<{ code: string; name: string; avatar: string | null; count: number; user_id?: string }>;
    cyclers: Array<{ name: string; avatar: string | null; cycles: number; earnings: number; user_id?: string }>;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    amount: number;
    description: string;
    timestamp: string;
    status: string;
    user: { full_name: string; avatar_url: string | null; user_id?: string };
  }>;
  insights: string[];
  config: {
    entryFee: number;
    targetAmount: number;
    profitAmount: number;
    adminFee: number;
  };
  generatedAt: string;
  nigerianDate: string;
  timeRange: TimeRangeValue;
}

export function useAdminDashboardAnalytics(
  timeRange: TimeRangeValue = 30,
  customRange?: CustomDateRange,
  refreshInterval = 30000
) {
  const queryKey = ['admin-dashboard-analytics', timeRange, customRange?.startDate?.toISOString(), customRange?.endDate?.toISOString()];

  return useQuery({
    queryKey,
    queryFn: async (): Promise<AdminDashboardAnalytics> => {
      const body: {
        timeRange: TimeRangeValue;
        customStartDate?: string;
        customEndDate?: string;
      } = { timeRange };

      if (timeRange === 'custom' && customRange?.startDate && customRange?.endDate) {
        body.customStartDate = formatDateToNigerianYMD(customRange.startDate);
        body.customEndDate = formatDateToNigerianYMD(customRange.endDate);
      }

      const { data, error } = await supabase.functions.invoke('get-admin-dashboard-analytics', {
        body
      });
      
      if (error) {
        console.error('Error fetching admin dashboard analytics:', error);
        throw error;
      }
      
      return data;
    },
    refetchInterval: refreshInterval,
    staleTime: 10000,
  });
}

function formatDateToNigerianYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
