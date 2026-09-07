import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface RejectAvatarParams {
  userId: string;
  reason: string;
}

export const useAvatarModeration = () => {
  const queryClient = useQueryClient();

  const rejectAvatarMutation = useMutation({
    mutationFn: async ({ userId, reason }: RejectAvatarParams) => {
      const { data, error } = await supabase.functions.invoke('reject-avatar', {
        body: { userId, reason },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to reject avatar');

      return data;
    },
    onSuccess: (data, variables) => {
      toast({
        title: 'Avatar Removed',
        description: data.message,
      });

      // Invalidate user details query to refresh the drawer
      queryClient.invalidateQueries({ queryKey: ['user-details', variables.userId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Reject Avatar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    rejectAvatar: rejectAvatarMutation.mutate,
    isRejecting: rejectAvatarMutation.isPending,
  };
};
