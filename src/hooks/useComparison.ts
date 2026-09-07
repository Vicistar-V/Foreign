import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ComparisonBatchPair {
  category_slug: string;
  category_name: string;
  image_a: { id: string; url: string };
  image_b: { id: string; url: string };
}

/**
 * Pulls a fresh batch of image pairs.
 * The platform doesn't track per-pick votes anymore — the pair is purely
 * what the user sees on screen, nothing is sent back about which side won.
 */
export const fetchComparisonBatch = async (): Promise<{
  pairs: ComparisonBatchPair[];
  task: any;
}> => {
  const { data, error } = await supabase.rpc('task_get_batch');
  if (error) throw error;
  const d = data as any;
  if (!d?.success) throw new Error(d?.error || 'failed');
  return { pairs: d.pairs as ComparisonBatchPair[], task: d.task };
};

/** Fetch a single replacement pair (used when an image is reported broken). */
export const fetchSingleReplacementPair = async (): Promise<ComparisonBatchPair | null> => {
  const { data, error } = await supabase.rpc('task_get_batch', { _size: 1 });
  if (error) return null;
  const d = data as any;
  if (!d?.success) return null;
  const first = (d.pairs as ComparisonBatchPair[])[0];
  return first ?? null;
};

export interface ComparisonChoice {
  category_slug: string;
  image_a_id: string;
  image_b_id: string;
  chosen_image_id: string;
}

/**
 * Mark one batch as completed and ledger every pick.
 * The server records each choice (which image the user picked between the pair)
 * for ML training, then credits the pending-wallet earnings.
 */
export const useSubmitBatch = () => {
  const qc = useQueryClient();
  return useMutation({
    // F4: send a per-attempt idempotency key so a retry after network timeout
    // does NOT double-credit ₦50. The server dedupes on this key.
    mutationFn: async (
      input: ComparisonChoice[] | { choices?: ComparisonChoice[]; idempotencyKey?: string } = [],
    ) => {
      const choices = Array.isArray(input) ? input : (input.choices ?? []);
      const idempotencyKey =
        (!Array.isArray(input) && input.idempotencyKey) ||
        (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const { data, error } = await supabase.rpc('task_submit_batch', {
        _choices: choices as any,
        _idempotency_key: idempotencyKey,
      } as any);
      if (error) throw error;
      const d = data as any;
      if (!d?.success) throw new Error(d?.error || 'failed');
      return d as {
        success: true;
        batch: {
          success: true;
          batches_done: number;
          bonus_batches: number;
          total_batches_today: number;
          naira_added: number;
          pending_balance: number;
        };
        task: any;
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-task'] });
      qc.invalidateQueries({ queryKey: ['balances'] });
    },
  });
};

export const useReportBrokenImage = () =>
  useMutation({
    mutationFn: async (image_id: string) => {
      const { data, error } = await supabase.rpc('task_report_broken_image', { _image_id: image_id });
      if (error) throw error;
      return data;
    },
  });

export const useComparisonCategories = () =>
  useQuery({
    queryKey: ['comparison-categories'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comparison_categories')
        .select('slug, name, sort_order')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
  });
