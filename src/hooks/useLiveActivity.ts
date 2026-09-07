import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LiveActivityEvent {
  id: string;
  type: 'payout' | 'activation' | 'referral' | 'withdrawal';
  firstName: string;
  avatarUrl: string | null;
  userId: string;
  amount: number;
  message: string;
  timestamp: string;
}

interface LiveActivityResponse {
  events: LiveActivityEvent[];
}

export function useLiveActivity() {
  return useQuery({
    queryKey: ['live-activity'],
    queryFn: async (): Promise<LiveActivityEvent[]> => {
      const { data, error } = await supabase.functions.invoke<LiveActivityResponse>('get-live-activity');
      
      if (error) {
        console.error('Failed to fetch live activity:', error);
        throw error;
      }
      
      return data?.events || [];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
  });
}
