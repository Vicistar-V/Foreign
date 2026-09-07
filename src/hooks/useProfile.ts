import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { handleAuthError } from '@/lib/handleAuthError';

export interface ProfileData {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  is_member: boolean | null;
  is_banned: boolean | null;
  banned_reason: string | null;
  is_name_locked: boolean | null;
  referral_code: string | null;
  phone_number: string | null;
  auto_compound_enabled: boolean | null;
  last_payout_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  activated_at: string | null;
  has_seen_explainer: boolean | null;
  birth_year: number | null;
  birth_month: number | null;
  state_of_residence: string | null;
  has_pin: boolean;
}

export const useProfile = (userId?: string) => {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async (): Promise<ProfileData> => {
      if (!userId) throw new Error('No user ID');

      const { data, error } = await supabase.rpc('get_my_profile');

      if (error) {
        const wasAuthError = await handleAuthError(error);
        if (wasAuthError) {
          throw new Error('Session expired');
        }
        throw error;
      }

      return data as unknown as ProfileData;
    },
    enabled: !!userId,
    // Profile controls setup gates like PIN and profile photo, so it must not
    // stay stale after backend fixes or account changes.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    gcTime: 30 * 60 * 1000,
  });
};

