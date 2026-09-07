import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Notification {
  id: string;
  source: 'notification' | 'admin_notification';
  event_type: string;
  title?: string;
  message?: string;
  event_data: Record<string, any>;
  created_at: string;
  read_at: string | null;
}

export type NotificationFilter = 'all' | 'unread' | 'wins' | 'money' | 'alerts' | 'support';

interface NotificationsResponse {
  notifications: Notification[];
  unread_count: number;
  total_count: number;
  filtered_count?: number;
  hasMore?: boolean;
  limit?: number;
  offset?: number;
}

export const useNotifications = (
  limit = 10,
  offset = 0,
  filter: NotificationFilter = 'all',
) => {
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['notifications', filter, limit, offset],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('notifications', {
        body: { action: 'get', limit, offset, filter },
      });

      if (error) throw error;
      if (data?.success === false) {
        throw new Error(data.error || 'Failed to fetch notifications');
      }
      return data as NotificationsResponse;
    },
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notifications: Array<{ id: string; source: 'notification' | 'admin_notification' }>) => {
      const { data, error } = await supabase.functions.invoke('notifications', {
        body: { action: 'mark_read', notification_ids: notifications },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || 'Failed to mark notifications as read');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('notifications', {
        body: { action: 'mark_all_read' },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || 'Failed to mark all notifications as read');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    notifications: data?.notifications || [],
    unreadCount: data?.unread_count || 0,
    totalCount: data?.total_count || 0,
    filteredCount: data?.filtered_count ?? data?.total_count ?? 0,
    hasMore: data?.hasMore ?? false,
    isLoading,
    isFetching,
    error,
    refetch,
    markAsRead: (notifications: Array<{ id: string; source: 'notification' | 'admin_notification' }>) =>
      markAsReadMutation.mutate(notifications),
    markAllAsRead: () => markAllAsReadMutation.mutate(),
    isMarkingAsRead: markAsReadMutation.isPending,
    isMarkingAllAsRead: markAllAsReadMutation.isPending,
  };
};
