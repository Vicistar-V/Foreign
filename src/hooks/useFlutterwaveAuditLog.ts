import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FlutterwaveAuditLog {
  id: string;
  alert_type: string;
  severity: string;
  message: string;
  metadata: {
    admin_id?: string;
    reference?: string;
    amount?: number;
    bank_code?: string;
    account_number?: string;
    narration?: string;
    flutterwave_id?: number;
    status?: string;
    transfer_id?: number;
    retry_response?: any;
    bank_name?: string;
  };
  created_at: string;
  admin_name: string;
}

interface AuditLogResponse {
  success: boolean;
  logs: FlutterwaveAuditLog[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface UseFlutterwaveAuditLogParams {
  limit?: number;
  offset?: number;
  fromDate?: string;
  toDate?: string;
}

export const useFlutterwaveAuditLog = (params: UseFlutterwaveAuditLogParams = {}) => {
  return useQuery({
    queryKey: ['flutterwave-audit-logs', params],
    queryFn: async (): Promise<AuditLogResponse> => {
      const { data, error } = await supabase.functions.invoke('get-flutterwave-audit-logs', {
        body: {
          limit: params.limit || 20,
          offset: params.offset || 0,
          fromDate: params.fromDate,
          toDate: params.toDate,
        },
      });

      if (error) {
        console.error('[useFlutterwaveAuditLog] Error:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to fetch audit logs');
      }

      return data;
    },
    staleTime: 30 * 1000, // 30 seconds
  });
};
