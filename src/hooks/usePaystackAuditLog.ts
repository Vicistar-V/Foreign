import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FlutterwaveAuditLog } from './useFlutterwaveAuditLog';

interface Response {
  success: boolean;
  logs: FlutterwaveAuditLog[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface Params {
  limit?: number;
  offset?: number;
  fromDate?: string;
  toDate?: string;
}

export const usePaystackAuditLog = (params: Params = {}) => {
  return useQuery({
    queryKey: ['paystack-audit-logs', params],
    queryFn: async (): Promise<Response> => {
      const { data, error } = await supabase.functions.invoke('get-paystack-audit-logs', {
        body: {
          limit: params.limit || 20,
          offset: params.offset || 0,
          fromDate: params.fromDate,
          toDate: params.toDate,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to fetch audit logs');
      return data;
    },
    staleTime: 30 * 1000,
  });
};
