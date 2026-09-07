import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WebhookLog {
  id: string;
  type: 'webhook';
  event_type: string;
  success: boolean;
  error_message: string | null;
  created_at: string;
  data: Record<string, unknown>;
  signature: string | null;
}

export interface SystemAlert {
  id: string;
  type: 'alert';
  alert_type: string;
  severity: string;
  message: string;
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  data: Record<string, unknown> | null;
}

export type SystemLog = WebhookLog | SystemAlert;

interface LogsResponse {
  logs: SystemLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export const useSystemLogs = (
  logType: 'webhooks' | 'alerts' = 'webhooks',
  page: number = 1,
  search: string = ''
) => {
  return useQuery({
    queryKey: ['system-logs', logType, page, search],
    queryFn: async (): Promise<LogsResponse> => {
      const params = new URLSearchParams({
        type: logType,
        page: page.toString(),
        limit: '50'
      });
      
      if (search) {
        params.set('search', search);
      }

      const response = await fetch(
        `https://sbprvewcfrtazdlcfvxt.supabase.co/functions/v1/get-system-logs?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch logs');
      }

      return response.json();
    },
    staleTime: 30 * 1000,
  });
};

export const useAcknowledgeAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const { data, error } = await supabase.functions.invoke('admin-alert-action', {
        body: { alertId, action: 'acknowledge' }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      toast.success('Alert acknowledged');
      queryClient.invalidateQueries({ queryKey: ['system-logs', 'alerts'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to acknowledge', { description: error.message });
    }
  });
};
