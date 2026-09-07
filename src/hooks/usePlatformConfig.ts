import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const usePlatformConfig = () => {
  const query = useQuery({
    queryKey: ['platform-config'],
    queryFn: async () => {
      // Direct RPC call (no edge function) — saves edge-function quota.
      // The `get_platform_config` SQL function is SECURITY DEFINER and
      // grantable to anon + authenticated, so it works for everyone.
      const { data, error } = await supabase.rpc('get_platform_config');

      if (error) {
        console.error('[usePlatformConfig] Failed to fetch platform config:', error);
        throw error;
      }

      if (!data) {
        throw new Error('No platform config data returned');
      }

      return data as Record<string, any>;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 2,
    refetchInterval: 60 * 1000, // Poll every minute for updates
  });

  return query;
};
