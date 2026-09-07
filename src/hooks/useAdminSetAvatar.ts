import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { compressImage } from '@/lib/imageCompression';

export const useAdminSetAvatar = () => {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ userId, file }: { userId: string; file: File }) => {
      const compressed = await compressImage(file);
      const fileName = file.name.toLowerCase().endsWith('.png')
        ? 'avatar.png'
        : 'avatar.jpg';

      // Reuses the existing upload-avatar function with targetUserId for admin use.
      const { data, error } = await supabase.functions.invoke('upload-avatar', {
        body: { targetUserId: userId, imageData: compressed, fileName },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to set photo');
      return data;
    },
    onSuccess: (data, vars) => {
      toast({ title: 'Photo Set', description: data.message });
      qc.invalidateQueries({ queryKey: ['user-details', vars.userId] });
    },
    onError: (e: Error) => {
      toast({
        title: 'Could not set photo',
        description: e.message,
        variant: 'destructive',
      });
    },
  });

  return {
    setAvatar: mutation.mutate,
    isSetting: mutation.isPending,
  };
};
