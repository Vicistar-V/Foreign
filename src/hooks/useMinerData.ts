import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Member {
  id: string;
  name: string;
  avatar_url: string | null;
  is_member: boolean;
  has_spot: boolean;
  spot_count: number;
  joined_at: string;
  last_activity: string;
  total_yields: number;
  referrer_earnings: number;
}

export interface MinerSummary {
  total_members: number;
  active_members: number;
  pending_members: number;
  total_spots_in_network: number;
  total_network_yields: number;
  total_royalty_earnings: number;
  per_yield_potential: number;
}

export interface MinerData {
  members: Member[];
  summary: MinerSummary;
  referralCode: string;
}

export const useMinerData = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['member-data', user?.id],
    queryFn: async (): Promise<MinerData> => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Get user's referral code
      const { data: profile } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', user.id)
        .single();

      // Call the database function
      const { data, error } = await supabase.rpc('get_miner_details', {
        _user_id: user.id
      });

      if (error) {
        console.error('[useMinerData] Error:', error);
        throw new Error('Failed to load member data');
      }

      // Cast data to expected shape
      const result = data as unknown as {
        success: boolean;
        error?: string;
        members?: Member[];
        summary?: MinerSummary;
      } | null;

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to load member data');
      }

      return {
        members: result.members || [],
        summary: result.summary || {
          total_members: 0,
          active_members: 0,
          pending_members: 0,
          total_spots_in_network: 0,
          total_network_yields: 0,
          total_royalty_earnings: 0,
          per_yield_potential: 0
        },
        referralCode: profile?.referral_code || ''
      };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 3,
  });
};