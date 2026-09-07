import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Bank {
  id: string;
  code: string;
  name: string;
  country: string;
  created_at: string;
  updated_at: string;
}

export const useBanks = (country: string = 'NG') => {
  return useQuery({
    queryKey: ['banks', country],
    queryFn: async () => {
      console.log(`Fetching banks for country: ${country}`);
      
      const { data, error } = await supabase.rpc('get_banks', {
        _country: country
      });

      if (error) {
        console.error('Error fetching banks:', error);
        throw error;
      }

      console.log(`Loaded ${data?.length || 0} banks from database`);
      return data as Bank[];
    },
    staleTime: 1000 * 60 * 60 * 24, // Cache for 24 hours
    gcTime: 1000 * 60 * 60 * 24 * 7, // Keep in cache for 7 days
  });
};
