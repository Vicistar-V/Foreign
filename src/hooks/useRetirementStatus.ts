import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { setCachedIsRetired } from '@/lib/restoreCapacityStore';

export interface RetirementStatus {
  is_member: boolean;
  active_spots: number;
  previous_capacity: number;
  is_retired: boolean;
  deposit_balance: number;
  earnings_balance: number;
  combined_balance: number;
  base_fee: number;
  extra_fee: number;
  payout_per_spot: number;
}

export const useRetirementStatus = () => {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['retirement-status', user?.id],
    queryFn: async (): Promise<RetirementStatus> => {
      const { data, error } = await supabase.rpc('get_retirement_status');
      if (error) throw error;
      return data as unknown as RetirementStatus;
    },
    enabled: !!user,
    staleTime: 15 * 1000,
    refetchOnWindowFocus: true,
  });

  // Keep the module-level cache in sync so non-React callers
  // (startExtensionPayment, buy-spot buttons, etc.) can intercept.
  useEffect(() => {
    setCachedIsRetired(!!query.data?.is_retired);
  }, [query.data?.is_retired]);

  return query;
};
