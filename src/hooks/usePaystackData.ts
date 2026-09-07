// Returns the SAME shape as useFlutterwaveData so the existing admin UI
// components (balance cards, tables, detail drawer, quick stats) can render
// either provider without modification.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FlutterwaveDataResponse, DateRangeFilter } from './useFlutterwaveData';

export const usePaystackData = (dateRange?: DateRangeFilter) => {
  const fromDate = dateRange?.fromDate || null;
  const toDate = dateRange?.toDate || null;

  return useQuery({
    queryKey: ['paystack-data', fromDate, toDate],
    queryFn: async (): Promise<FlutterwaveDataResponse> => {
      const { data, error } = await supabase.functions.invoke('get-paystack-data', {
        body: { fromDate, toDate },
      });
      if (error) {
        console.error('[usePaystackData] Error:', error);
        throw new Error(error.message || 'Failed to fetch Paystack data');
      }
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to fetch Paystack data');
      }
      return data as FlutterwaveDataResponse;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
};
