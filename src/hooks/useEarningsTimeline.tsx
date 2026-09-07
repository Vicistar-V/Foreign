import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface UniqueEarner {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  total_earned_today: number;
  spots_count: number;
}

export interface SpotOwner {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  total_spots: number;
}

export interface SpotEntry {
  spot_id: string;
  spot_name: string;
  cycles_today: number;
  total_earned_today: number;
  last_cycle_at: string;
  owner: SpotOwner;
}

export interface DayStats {
  total_cycles: number;
  total_distributed: number;
  unique_earners_count: number;
}

export interface DayData {
  date: string;
  label: string;
  unique_earners: UniqueEarner[];
  spots: SpotEntry[];
  stats: DayStats;
  has_more_spots: boolean;
}

export interface GlobalStats {
  all_time_cycles: number;
  all_time_distributed: number;
  today_cycles: number;
}

export interface EarningsTimelineData {
  days: DayData[];
  global_stats: GlobalStats;
}

export const useEarningsTimeline = (daysBack = 7, spotsPerDay = 10) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['earnings-timeline', daysBack, spotsPerDay],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-winners', {
        body: { days_back: daysBack, spots_per_day: spotsPerDay },
      });

      if (error) throw error;
      return data as EarningsTimelineData;
    },
    staleTime: 30000,
  });

  // Refresh from the safe server function when the queue moves.
  // Raw drops rows are never sent to the browser.
  useEffect(() => {
    const channel = supabase
      .channel('public:earnings-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_update_signals',
          filter: 'signal_type=eq.queue_changed',
        },
        () => queryClient.invalidateQueries({ queryKey: ['earnings-timeline'] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    days: query.data?.days || [],
    globalStats: query.data?.global_stats,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};
