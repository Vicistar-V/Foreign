import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface PaymentAttempt {
  id: string;
  tx_ref: string;
  amount: number;
  purpose: 'membership' | 'deposit';
  status: 'pending' | 'verified' | 'failed';
  created_at: string;
  verified_at: string | null;
  flutterwave_id: string | null;
}

export const usePaymentAttempts = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['payment-attempts', user?.id],
    queryFn: async (): Promise<PaymentAttempt[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('payment_attempts')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        // Moniepoint attempts auto-resolve via webhook + realtime; the manual
        // "verify" path only exists for Flutterwave attempts.
        .neq('provider', 'moniepoint')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Failed to fetch payment attempts:', error);
        return [];
      }

      return (data || []) as PaymentAttempt[];
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000, // 30 seconds
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['payment-attempts', user?.id] });
  };

  return {
    ...query,
    invalidate,
  };
};
