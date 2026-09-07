import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface WithdrawalAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  is_verified: boolean;
  is_primary: boolean;
  created_at: string;
}

interface WithdrawalAccountsResponse {
  accounts: WithdrawalAccount[];
}

export const useWithdrawalAccounts = (userId?: string) => {
  return useQuery({
    queryKey: ['withdrawal-accounts', userId],
    queryFn: async () => {
      if (!userId) throw new Error('No user ID');

      const { data, error } = await supabase.rpc('get_my_withdrawal_accounts');

      if (error) throw error;
      return (data ?? { accounts: [] }) as unknown as WithdrawalAccountsResponse;
    },
    enabled: !!userId,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 30 * 60 * 1000,
  });
};
