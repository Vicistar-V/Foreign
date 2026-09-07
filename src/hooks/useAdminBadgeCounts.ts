import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AdminBadgeCounts = {
  depositsCount: number;
  withdrawalsCount: number;
  supportCount: number;
};

export const useAdminBadgeCounts = (): AdminBadgeCounts => {
  const { data: deposits = 0 } = useQuery({
    queryKey: ['admin-badge-deposits'],
    queryFn: async () => {
      const { count } = await supabase
        .from('payment_attempts' as any)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      return count ?? 0;
    },
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });

  const { data: withdrawals = 0 } = useQuery({
    queryKey: ['admin-badge-withdrawals'],
    queryFn: async () => {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) return 0;
      try {
        const res = await fetch(
          `https://sbprvewcfrtazdlcfvxt.supabase.co/functions/v1/get-pending-withdrawals?status=pending&page=1&limit=1`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        if (!res.ok) return 0;
        const json = await res.json();
        return json?.pagination?.total ?? 0;
      } catch {
        return 0;
      }
    },
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });

  const { data: support = 0 } = useQuery({
    queryKey: ['admin-badge-support'],
    queryFn: async () => {
      const { count } = await supabase
        .from('support_tickets' as any)
        .select('id', { count: 'exact', head: true })
        .in('status', ['open', 'waiting_user']);
      return count ?? 0;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return {
    depositsCount: deposits,
    withdrawalsCount: withdrawals,
    supportCount: support,
  };
};
