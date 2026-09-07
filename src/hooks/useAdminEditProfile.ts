import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type AdminEditAction = 
  | 'update_name' 
  | 'update_phone' 
  | 'toggle_name_lock' 
  | 'reset_pin' 
  | 'force_verify_email';

interface AdminEditParams {
  action: AdminEditAction;
  userId: string;
  pin: string;
  newName?: string;
  newPhone?: string;
}

interface AdminEditResponse {
  success: boolean;
  message: string;
  is_name_locked?: boolean;
}

export const useAdminEditProfile = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (params: AdminEditParams): Promise<AdminEditResponse> => {
      const { data, error } = await supabase.functions.invoke('admin-edit-profile', {
        body: params
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to update profile');

      return data;
    },
    onSuccess: (data, variables) => {
      toast.success(data.message || 'Profile updated successfully');
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['user-details', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update profile');
    }
  });

  return {
    editProfile: mutation.mutate,
    editProfileAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
};
