import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { handleAuthError } from '@/lib/handleAuthError';

/**
 * Empire mode: every active spot a user owns points to the SAME shared drop
 * (one ticket per user, locked to their earliest position). Buying another
 * spot grows that ticket's target_amount by drop_target_amount rather than
 * creating a new drop. So `spot.current_drop` on every spot is a copy of the
 * user's `shared_drop`.
 */
export interface SharedDrop {
  drop_id: string;
  id: string;
  position: number;
  fill_amount: number;
  target_amount: number;
  fill_percentage: number;
  status: string;
  source_type: string;
}

export interface Spot {
  spot_id: string;
  spot_name: string;
  status: string;
  /** True when this spot was purchased as an extension of an existing ticket
   *  (i.e. it grew the shared drop's target by drop_target_amount instead of
   *  starting a new drop). The first spot of a cycle is always false. */
  is_extension?: boolean;
  total_cycles: number;
  total_earnings: number;
  created_at: string;
  current_drop: SharedDrop | null;
}

export interface FillingDrop {
  id: string;
  position: number;
  fill_amount: number;
  target_amount: number;
  fill_percent: number;
  status: string;
  user_id: string | null;
  user_name: string;
  avatar_url: string | null;
  spot_name: string;
  spots_count?: number;
  has_referrer: boolean;
}

export interface DropStatusData {
  user: {
    spots: Spot[];
    /** The user's single active ticket in Empire mode. All spots share it. */
    shared_drop: SharedDrop | null;
    active_spots_count: number;
    total_earnings_all_time: number;
    total_spots_count?: number;
    total_earnings_all_spots?: number;
    total_cycles_all_spots?: number;
    has_more_spots?: boolean;
  };

  queue: {
    total_in_queue: number;
    total_queue_count: number;
    next_position_to_pay: number;
    paid_today_count: number;
    paid_today_amount: number;
    last_payout_at: string | null;
  };
  config: {
    entry_fee: number;
    queue_contribution?: number;
    target_amount: number;
    profit_amount: number;
    profit_amount_first_cycle?: number;
    profit_amount_subsequent?: number;
    system_active: boolean;
    pulse_interval: number;
  };
  currently_filling: FillingDrop[];
  recent_payouts: {
    type: 'payout';
    position: number;
    paid_at: string;
    created_at: string;
    user_id: string | null;
    user_name: string;
    avatar_url: string | null;
    referred_by_code: string | null;
    profit: number;
  }[];
  recent_referral_bonuses: {
    type: 'referral';
    id: string;
    created_at: string;
    earner_name: string;
    earner_avatar: string | null;
    referee_name: string;
    amount: number;
    bonus_type: 'activation' | 'cycle';
  }[];
}

export const useDropStatus = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['drop-status', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_drop_status');

      if (error) {
        console.error('Drop status error:', error);
        const wasAuthError = await handleAuthError(error);
        if (wasAuthError) {
          throw new Error('Session expired');
        }
        throw error;
      }

      const payload = data as unknown as DropStatusData & { success?: boolean; error?: string };
      if (payload && payload.success === false) {
        throw new Error(payload.error || 'Could not load your campaign right now');
      }

      return payload as DropStatusData;
    },
    enabled: !!user,
    // Realtime: live_update_signals fires on every drops/spots change,
    // and useDropsRealtime invalidates this query, so no polling needed.
    staleTime: 5 * 1000,
    refetchOnWindowFocus: true,
  });
};

export const useBuySpot = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      params:
        | 'earnings'
        | 'deposit'
        | { sourceWallet: 'earnings' | 'deposit'; count?: number }
        = 'deposit'
    ) => {
      const sourceWallet =
        typeof params === 'string' ? params : params.sourceWallet;
      const rawCount = typeof params === 'string' ? 1 : params.count ?? 1;
      const count = Math.max(1, Math.min(50, Math.floor(rawCount)));

      const results: any[] = [];
      for (let i = 0; i < count; i++) {
        const { data, error } = await supabase.functions.invoke('buy-spot', {
          body: { source_wallet: sourceWallet },
        });

        if (error) {
          // If we've already bought some, surface partial success in the error
          if (results.length > 0) {
            throw new Error(
              `Activated ${results.length} of ${count} shares, then failed: ${error.message}`
            );
          }
          throw error;
        }

        if (!data?.success) {
          if (results.length > 0) {
            throw new Error(
              `Activated ${results.length} of ${count} shares, then failed: ${data?.error || 'Unknown error'}`
            );
          }
          throw new Error(data?.error || 'Could not activate the share');
        }

        results.push(data);
      }

      return { results, count: results.length, last: results[results.length - 1] };
    },
    onSuccess: (data: any) => {
      const n = data?.count ?? 1;
      // Empire mode: extra spots EXTEND the same ticket's target (buy-spot
      // returns { extended: true, new_target, position }). We frame the toast
      // around "line extended to ₦X" instead of "Position #Y", because the
      // position is locked to the first spot and doesn't move.
      const results: any[] = data?.results ?? [];
      const anyExtended = results.some((r) => r?.extended === true);
      const last = data?.last;
      const finalTarget = Number(last?.new_target ?? 0);
      toast({
        title: n > 1 ? `${n} shares activated` : 'Share activated',
        description: anyExtended && finalTarget > 0
          ? `You now have shares paying ₦${finalTarget.toLocaleString()} when your campaign finishes.`
          : n > 1
            ? `You now have ${n} more shares in this campaign`
            : 'You now have a share in this campaign',
      });

      queryClient.invalidateQueries({ queryKey: ['drop-status', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['balances', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['transactions', user?.id] });
    },
    onError: (error: any) => {
      toast({
        title: 'Could not activate share',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
      // Refresh balances even on partial failure
      queryClient.invalidateQueries({ queryKey: ['drop-status', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['balances', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['transactions', user?.id] });
    },
  });
};

