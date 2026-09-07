import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DepositUser {
  full_name: string;
  avatar_url: string | null;
}

export interface AdminDeposit {
  id: string;
  type: string;
  user_id: string;
  user: DepositUser;
  amount: number;
  status: string;
  payment_reference: string | null;
  created_at: string;
  data: Record<string, unknown> | null;
}

interface DepositsResponse {
  logs: AdminDeposit[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export const useAdminDeposits = (page: number = 1) => {
  return useQuery({
    queryKey: ['admin-deposits', page],
    queryFn: async (): Promise<DepositsResponse> => {
      const response = await fetch(
        `https://sbprvewcfrtazdlcfvxt.supabase.co/functions/v1/get-system-logs?type=deposits&page=${page}&limit=20`,
        {
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch deposits');
      }

      return response.json();
    },
    staleTime: 30 * 1000,
  });
};

export const useDepositAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      transactionId, 
      action, 
      reason 
    }: { 
      transactionId: string; 
      action: 'verify' | 'complete' | 'reject'; 
      reason?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('admin-deposit-action', {
        body: { transactionId, action, reason }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Action completed');
      queryClient.invalidateQueries({ queryKey: ['admin-deposits'] });
    },
    onError: (error: Error) => {
      toast.error('Action failed', { description: error.message });
    }
  });
};
