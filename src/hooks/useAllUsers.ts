import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';

export interface UserCurrentLocation {
  page_name: string;
  page_path: string;
  last_seen_at: string;
}

export interface UserListItem {
  id: string;
  full_name: string;
  email: string;
  referral_code: string;
  referred_by_code: string | null;
  referrer_name: string | null;
  referrer_id: string | null;
  is_member: boolean;
  is_banned: boolean;
  banned_reason: string | null;
  avatar_url: string | null;
  created_at: string;
  activated_at: string | null;
  birth_year: number | null;
  birth_month: number | null;
  total_earnings: number;
  referral_count: number;
  balances: {
    earnings_balance: number;
    deposit_balance: number;
    pending_balance?: number;
  };
  phone_number: string | null;
  is_name_locked: boolean;
  last_sign_in_at: string | null;
  last_activity_at: string | null;
  email_confirmed: boolean;
  total_drops_joined?: number;
  win_rate?: number;
  total_spots?: number;
  active_spots?: number;
  total_cycles?: number;
  current_location: UserCurrentLocation | null;
  tour_status: 'never_started' | 'in_progress' | 'completed';
  tour_step: string | null;
}

export interface UserListFilters {
  search: string;
  membership_status: 'all' | 'member' | 'not_member';
  banned_status: 'all' | 'banned' | 'not_banned';
  activity_status: 'all' | 'active' | 'idle' | 'dormant' | 'never';
  email_status: 'all' | 'verified' | 'unverified';
  has_drops: 'all' | 'yes' | 'no';
  phone_status: 'all' | 'has_phone' | 'no_phone';
  tour_status: 'all' | 'never_started' | 'in_progress' | 'completed';
  sort_by: 'name' | 'created_at' | 'earnings' | 'referrals' | 'drops' | 'last_active';
  sort_order: 'asc' | 'desc';
}

export interface UserListPagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface UserListStats {
  total_users: number;
  active_members: number;
  banned_users: number;
  online_now: number;
}

export interface UserListResponse {
  success: boolean;
  users: UserListItem[];
  pagination: UserListPagination;
  stats: UserListStats;
}

const defaultFilters: UserListFilters = {
  search: '',
  membership_status: 'all',
  banned_status: 'all',
  activity_status: 'all',
  email_status: 'all',
  has_drops: 'all',
  phone_status: 'all',
  tour_status: 'all',
  sort_by: 'created_at',
  sort_order: 'desc'
};

export const useAllUsers = (page: number = 1, limit: number = 25, filters: UserListFilters = defaultFilters) => {
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  const queryClient = useQueryClient();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // Realtime subscription — admin sees user movement instantly
  useEffect(() => {
    const channel = supabase
      .channel('admin-user-activity-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_activity_log' }, () => {
        queryClient.invalidateQueries({ queryKey: ['all-users'] });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        const newRow = payload.new as { last_seen_at?: string };
        const oldRow = payload.old as { last_seen_at?: string };
        if (newRow?.last_seen_at && newRow.last_seen_at !== oldRow?.last_seen_at) {
          queryClient.invalidateQueries({ queryKey: ['all-users'] });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: [
      'all-users', 
      page, 
      limit, 
      debouncedSearch, 
      filters.membership_status, 
      filters.banned_status, 
      filters.activity_status,
      filters.email_status,
      filters.has_drops,
      filters.phone_status,
      filters.tour_status,
      filters.sort_by, 
      filters.sort_order
    ],
    queryFn: async () => {
      console.log('[useAllUsers] Fetching user list...');
      const { data, error } = await supabase.functions.invoke('get-all-users', {
        body: {
          page,
          limit,
          search: debouncedSearch,
          membership_status: filters.membership_status,
          banned_status: filters.banned_status,
          activity_status: filters.activity_status,
          email_status: filters.email_status,
          has_drops: filters.has_drops,
          phone_status: filters.phone_status,
          tour_status: filters.tour_status,
          sort_by: filters.sort_by,
          sort_order: filters.sort_order
        }
      });

      if (error) throw error;
      console.log('[useAllUsers] Fetched', data?.users?.length, 'users');
      return data as UserListResponse;
    },
    staleTime: 20 * 1000, // 20 seconds - data considered fresh
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
    refetchOnWindowFocus: true, // Refresh when user returns to tab
    refetchOnReconnect: true, // Refresh when network reconnects
  });
};

// Helper function to get activity status from last_activity_at (now powered by reliable heartbeat)
// Uses tighter thresholds since heartbeat updates every 60 seconds
export const getActivityStatus = (lastActivityAt: string | null): 'active' | 'idle' | 'dormant' | 'never' => {
  if (!lastActivityAt) return 'never';
  
  const lastActivity = new Date(lastActivityAt);
  const now = new Date();
  const minutesAgo = (now.getTime() - lastActivity.getTime()) / (1000 * 60);
  
  // Active: seen within last 5 minutes (heartbeat interval + buffer)
  if (minutesAgo <= 5) return 'active';
  // Idle: seen within last 60 minutes  
  if (minutesAgo <= 60) return 'idle';
  // Dormant: not seen in 60+ minutes
  return 'dormant';
};

// Helper function to format "last seen" text based on TRUE activity
export const formatLastSeen = (lastActivityAt: string | null): string => {
  if (!lastActivityAt) return 'Never active';
  
  const lastActivity = new Date(lastActivityAt);
  const now = new Date();
  const diffMs = now.getTime() - lastActivity.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
};
