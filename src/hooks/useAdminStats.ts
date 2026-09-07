import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AdminStats {
  success: boolean;
  totalMembers: number;
  activeSpots: number;
  dropsInQueue: number;
  totalDistributed: number;
  dropSystemActive: boolean;
  distributionActive: boolean;
  maintenanceMode: boolean;
  withdrawalsEnabled: boolean;
  telegramAlertsEnabled: boolean;
  recentActivity: Array<{
    date: string;
    count: number;
    type: string;
  }>;
}

export const useAdminStats = () => {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-admin-stats');

      if (error) throw error;
      if (data?.success === false) {
        throw new Error(data.error || 'Failed to fetch admin stats');
      }
      
      return data as AdminStats;
    },
    refetchInterval: 30 * 1000, // Refresh every 30 seconds
    staleTime: 15 * 1000, // 15 seconds
  });
};
