import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaymentAttemptUser {
  full_name: string;
  avatar_url: string | null;
}

export interface AdminPaymentAttempt {
  id: string;
  user_id: string;
  user: PaymentAttemptUser;
  tx_ref: string;
  amount: number;
  purpose: 'membership' | 'deposit';
  status: 'pending' | 'verified' | 'failed' | 'expired';
  provider: string | null;
  flutterwave_id: string | null;
  created_at: string;
  verified_at: string | null;
  metadata: Record<string, unknown> | null;
}

interface PaymentAttemptsResponse {
  attempts: AdminPaymentAttempt[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export const useAdminPaymentAttempts = (
  page: number = 1, 
  status: 'all' | 'pending' | 'verified' | 'failed' | 'expired' = 'all',
  userId?: string,
  pageSize: number = 20
) => {
  return useQuery({
    queryKey: ['admin-payment-attempts', page, status, userId, pageSize],
    queryFn: async (): Promise<PaymentAttemptsResponse> => {
      const session = await supabase.auth.getSession();
      if (!session.data.session) throw new Error('Not authenticated');

      // Build the query
      let query = supabase
        .from('payment_attempts')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      // Apply status filter
      if (status !== 'all') {
        query = query.eq('status', status);
      }

      // Apply user filter if provided
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: attempts, count, error } = await query;

      if (error) throw error;

      // Get user profiles
      const userIds = [...new Set(attempts?.map(a => a.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const formattedAttempts: AdminPaymentAttempt[] = (attempts || []).map(a => ({
        id: a.id,
        user_id: a.user_id,
        user: profilesMap.get(a.user_id) || { full_name: 'Unknown', avatar_url: null },
        tx_ref: a.tx_ref,
        amount: Number(a.amount),
        purpose: a.purpose as 'membership' | 'deposit',
        status: a.status as 'pending' | 'verified' | 'failed' | 'expired',
        provider: (a as any).provider ?? null,
        flutterwave_id: a.flutterwave_id,
        created_at: a.created_at,
        verified_at: a.verified_at,
        metadata: a.metadata as Record<string, unknown> | null,
      }));

      return {
        attempts: formattedAttempts,
        pagination: {
          page,
          limit: pageSize,
          total: count || 0,
          hasMore: ((page - 1) * pageSize + formattedAttempts.length) < (count || 0)
        }
      };
    },
    staleTime: 30 * 1000,
  });
};

export const useAdminPaymentAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      attemptId, 
      action, 
      reason,
      transactionId
    }: { 
      attemptId?: string; 
      action: 'verify' | 'complete' | 'reject'; 
      reason?: string;
      transactionId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('admin-payment-action', {
        body: { 
          attempt_id: attemptId, 
          transaction_id: transactionId,
          action, 
          reason 
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      if (data.status === 'already_done') {
        toast.info(data.message || 'Already processed');
      } else if (data.status === 'not_found') {
        toast.warning(data.message || 'Payment not found');
      } else if (data.status === 'pending') {
        toast.info(data.message || 'Payment still processing');
      } else if (data.status === 'failed') {
        toast.error(data.message || 'Payment failed');
      } else {
        toast.success(data.message || 'Action completed');
      }
      queryClient.invalidateQueries({ queryKey: ['admin-payment-attempts'] });
      queryClient.invalidateQueries({ queryKey: ['user-details'] });
    },
    onError: (error: Error) => {
      toast.error('Action failed', { description: error.message });
    }
  });
};
