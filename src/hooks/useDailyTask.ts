import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DailyTaskState {
  success: true;
  today: string;
  task_enabled: boolean;
  batches_done: number;
  bonus_batches: number;
  batches_per_day: number;
  /** True when platform runs unlimited-grind mode (batches_per_day = 0). */
  unlimited: boolean;
  taps_per_batch: number;
  naira_per_batch_for_user: number;
  naira_per_batch_base: number;
  spot_count: number;
  total_batches_today: number;
  can_do_more: boolean;
  loader_seconds: number;
  referral_bonus_batches: number;
  referral_cash_bonus: number;
  /** Pending-balance jump per activated referral (unlimited-mode shortcut). */
  referral_pending_bonus: number;
  pending_balance: number;
  pending_cap: number;
  capacity_full: boolean;
  extension_spot_price: number;
  payout_per_spot: number;
}

/**
 * Reads the current user's Daily Task state for today (Africa/Lagos).
 * NOTE: Batches are pushed to the server as a single unit via
 * useSubmitBatch in @/hooks/useComparison. There is no longer a
 * per-pick mutation — see DailyTask.tsx for the local-collect flow.
 */
export const useDailyTask = (userId?: string) =>
  useQuery({
    queryKey: ['daily-task', userId],
    enabled: !!userId,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<DailyTaskState> => {
      const { data, error } = await supabase.rpc('task_get_daily_task');
      if (error) throw error;
      const d = data as any;
      if (!d?.success) {
        throw new Error(d?.error || 'Failed to load daily task');
      }
      return d as DailyTaskState;
    },
  });
