import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';

interface SearchUser {
  id: string;
  full_name: string;
  email: string;
  referral_code: string;
  is_member: boolean;
  created_at: string;
  total_earnings: number;
  referral_count: number;
  avatar_url: string | null;
}

export const useUserSearch = (query: string) => {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return useQuery({
    queryKey: ['user-search', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.trim().length === 0) {
        return { success: true, users: [] };
      }

      const { data, error } = await supabase.functions.invoke('search-users', {
        body: { query: debouncedQuery },
      });

      if (error) throw error;

      return data as { success: boolean; users: SearchUser[] };
    },
    enabled: debouncedQuery.trim().length > 0,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};
