import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { handleAuthError } from '@/lib/handleAuthError';

interface DashboardData {
  profile: any;
  spots: any[];
  queueStats: any;
  config: any;
  stats: {
    referralCount: number;
    totalEarned: number;
    activeSpotCount: number;
    totalStaked: number;
    pendingBalance?: number;
  };
  isLegacyMember: boolean;
}

export const useDashboardData = () => {
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];

  const query = useQuery({
    queryKey: ['dashboard-data', user?.id, today],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('get-dashboard-data');

      if (error) {
        console.error('Dashboard data error:', error);
        const wasAuthError = await handleAuthError(error);
        if (wasAuthError) {
          throw new Error('Session expired');
        }
        throw error;
      }

      if (!data) {
        throw new Error('No data returned from edge function');
      }

      if (data?.success === false) {
        throw new Error(data.error || 'Failed to fetch dashboard data');
      }

      return data as DashboardData;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchInterval: 30 * 1000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};
