import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BanUserParams {
  userId: string;
  reason: string;
}

interface UnbanUserParams {
  userId: string;
}

export const useBanUser = () => {
  const queryClient = useQueryClient();

  const banMutation = useMutation({
    mutationFn: async ({ userId, reason }: BanUserParams) => {
      const { data, error } = await supabase.functions.invoke('admin-ban-action', {
        body: { action: 'ban', userId, reason }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to ban user');

      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'User has been banned');
      queryClient.invalidateQueries({ queryKey: ['user-details'] });
      queryClient.invalidateQueries({ queryKey: ['user-search'] });
    },
    onError: (error) => {
      console.error('Ban user error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to ban user');
    }
  });

  const unbanMutation = useMutation({
    mutationFn: async ({ userId }: UnbanUserParams) => {
      const { data, error } = await supabase.functions.invoke('admin-ban-action', {
        body: { action: 'unban', userId }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to restore access');

      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'User access has been restored');
      queryClient.invalidateQueries({ queryKey: ['user-details'] });
      queryClient.invalidateQueries({ queryKey: ['user-search'] });
    },
    onError: (error) => {
      console.error('Unban user error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to restore access');
    }
  });

  return {
    banUser: banMutation.mutate,
    unbanUser: unbanMutation.mutate,
    isBanning: banMutation.isPending,
    isUnbanning: unbanMutation.isPending
  };
};
