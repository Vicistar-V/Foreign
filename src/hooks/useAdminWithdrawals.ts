import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WithdrawalUser {
  full_name: string;
  avatar_url: string | null;
}

interface BankAccount {
  bank_name: string;
  account_number: string;
  account_name: string;
}

export interface AdminWithdrawal {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  payment_reference: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user: WithdrawalUser;
  bank_account: BankAccount | null;
  fee: number;
  transfer_amount: number;
  flutterwave_id: string | null;
  failure_reason: string | null;
}

interface WithdrawalsResponse {
  withdrawals: AdminWithdrawal[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export const useAdminWithdrawals = (status: string = 'all', page: number = 1) => {
  return useQuery({
    queryKey: ['admin-withdrawals', status, page],
    queryFn: async (): Promise<WithdrawalsResponse> => {
      const { data, error } = await supabase.functions.invoke('get-pending-withdrawals', {
        body: null,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Use URL params by calling with query string
      const response = await fetch(
        `https://sbprvewcfrtazdlcfvxt.supabase.co/functions/v1/get-pending-withdrawals?status=${status}&page=${page}&limit=20`,
        {
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch withdrawals');
      }

      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
  });
};

export const useWithdrawalAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      transactionId, 
      action, 
      reason 
    }: { 
      transactionId: string; 
      action: 'verify' | 'refund' | 'mark_complete' | 'manual_approve' | 'manual_decline'; 
      reason?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('admin-withdrawal-action', {
        body: { transactionId, action, reason }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Action completed');
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] });
    },
    onError: (error: Error) => {
      toast.error('Action failed', { description: error.message });
    }
  });
};
