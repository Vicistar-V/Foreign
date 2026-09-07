import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface ReferralStats {
  totalReferrals: number;
  activeMembers: number;
  totalEarned: number;
  pendingMembers: number;
}

interface Referral {
  id: string;
  firstName: string;
  email: string;
  joinedDate: string;
  activatedDate: string | null;
  isMember: boolean;
  bonusEarned: number;
  
}

interface RoyaltyTransaction {
  amount: number;
  createdAt: string;
  refereeName: string;
}

interface RoyaltiesData {
  totalRoyalties: number;
  royaltyCount: number;
  recentRoyalties: RoyaltyTransaction[];
}

// First cycle bonuses that have been paid
export interface FirstCycleBonusesData {
  total: number;
  count: number;
}

interface ReferralData {
  stats: ReferralStats;
  royalties: RoyaltiesData;
  referrals: Referral[];
  referralCode: string;
  firstCycleBonuses?: FirstCycleBonusesData;
}

export const useReferralData = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['referral-data', user?.id],
    queryFn: async (): Promise<ReferralData> => {
      try {
        const { data, error } = await supabase.functions.invoke('get-referral-details');

        if (error) {
          console.error('[useReferralData] Edge function error:', error);
          throw new Error('Failed to load referral data. Please try again.');
        }

        if (!data) {
          console.error('[useReferralData] No data returned from edge function');
          throw new Error('No referral data received. Please refresh.');
        }

        if (data?.success === false) {
          throw new Error(data.error || 'Failed to load referral data');
        }

        console.log('[useReferralData] Successfully fetched referral data');
        return data;
      } catch (error) {
        console.error('[useReferralData] Unexpected error:', error);
        throw error;
      }
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
    refetchOnWindowFocus: true,
    retry: 3, // Retry failed requests 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
};
