import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { handleAuthError } from '@/lib/handleAuthError';

interface Balances {
  earnings_balance: number;
  deposit_balance: number;
  pending_balance: number;
  last_updated: string;
  breakdown?: {
    from_referrals: number;
    from_wins: number;
  };
  active_spots_count?: number;
  total_staked?: number;
}

export const useBalances = (userId?: string) => {
  const query = useQuery({
    queryKey: ['balances', userId],
    queryFn: async (): Promise<Balances> => {
      if (!userId) throw new Error('No user ID');

      const { data, error } = await supabase.rpc('get_my_balances');

      if (error) {
        const wasAuthError = await handleAuthError(error);
        if (wasAuthError) {
          throw new Error('Session expired');
        }
        throw error;
      }

      const payload = data as unknown as (Balances & { success?: boolean; error?: string });
      if (payload && payload.success === false) {
        throw new Error(payload.error || 'Failed to fetch balances');
      }

      return payload;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchInterval: 30 * 1000,
  });

  return query;
};
