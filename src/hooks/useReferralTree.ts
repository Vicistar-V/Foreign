import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ReferralNode {
  id: string;
  full_name: string;
  avatar_url: string | null;
  referral_code: string;
  is_member: boolean;
  created_at: string;
  referral_count: number;
  earnings_generated: number;
  children: ReferralNode[];
}

interface ReferredBy {
  id: string;
  full_name: string;
  referral_code: string;
}

interface ReferralTreeResponse {
  tree: ReferralNode | null;
  referredBy: ReferredBy | null;
  stats: {
    direct_referrals: number;
    total_in_tree: number;
    total_earnings: number;
  } | null;
  error?: string;
}

export const useReferralTree = (searchQuery: string, userId?: string) => {
  return useQuery({
    queryKey: ['referral-tree', searchQuery, userId],
    queryFn: async (): Promise<ReferralTreeResponse> => {
      const params = new URLSearchParams();
      
      if (userId) {
        params.set('userId', userId);
      } else if (searchQuery) {
        params.set('search', searchQuery);
      } else {
        return { tree: null, referredBy: null, stats: null };
      }

      const response = await fetch(
        `https://sbprvewcfrtazdlcfvxt.supabase.co/functions/v1/get-referral-tree?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch referral tree');
      }

      return response.json();
    },
    enabled: !!(searchQuery || userId),
    staleTime: 60 * 1000,
  });
};
