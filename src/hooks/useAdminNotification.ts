import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SendNotificationParams {
  title: string;
  message: string;
  audience: 'all' | 'members' | 'non_members' | 'manual';
  user_ids?: string[];
}

export const useAdminNotification = () => {
  const queryClient = useQueryClient();

  const sendNotification = useMutation({
    mutationFn: async (params: SendNotificationParams) => {
      const { data, error } = await supabase.functions.invoke('send-admin-notification', {
        body: params,
      });

      if (error) throw error;
      if (data?.success === false) {
        throw new Error(data.error || 'Failed to send notification');
      }
      return data;
    },
    onSuccess: () => {
      // Invalidate notifications query so users see the new notification
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    sendNotification: sendNotification.mutate,
    isSending: sendNotification.isPending,
    error: sendNotification.error,
  };
};
