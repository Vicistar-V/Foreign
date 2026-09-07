import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type GrowthRange = '1d' | '2d' | '7d' | '14d' | '30d' | '90d' | 'all';
export type GrowthGranularity = 'hour' | 'day' | 'week';

export interface GrowthBucket {
  bucket: string; // ISO timestamp at bucket start
  signups: number;
  activations: number;
}

export interface UserGrowthTrend {
  range: GrowthRange;
  granularity: GrowthGranularity;
  periodStart: string;
  periodEnd: string;
  totalSignups: number;
  totalActivations: number;
  buckets: GrowthBucket[];
}

export function useUserGrowthTrend(range: GrowthRange) {
  return useQuery<UserGrowthTrend>({
    queryKey: ['user-growth-trend', range],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-user-growth-trend', {
        body: { range },
      });
      if (error) throw error;
      return data as UserGrowthTrend;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
