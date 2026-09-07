import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Wallet, User, HelpCircle, AlertOctagon, MessageSquare, ListTodo } from 'lucide-react';

export type TicketStatus = 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
export type TicketCategory = 'money_issue' | 'account_problem' | 'how_to_use' | 'complaint' | 'suggestion' | 'other';
export type TicketPriority = 'normal' | 'urgent';

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  metadata: Record<string, unknown>;
  user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    referral_code: string;
  };
  unread_count: number;
  message_count: number;
}

export interface TicketStats {
  total: number;
  open: number;
  in_progress: number;
  waiting_user: number;
  resolved: number;
  closed: number;
  urgent: number;
}

interface GetTicketsParams {
  status?: string;
  category?: string;
  priority?: string;
  page?: number;
  limit?: number;
  search?: string;
}

interface GetTicketsResponse {
  tickets: SupportTicket[];
  total: number;
  page: number;
  limit: number;
  stats: TicketStats | null;
  isAdmin: boolean;
}

export const useSupportTickets = (params: GetTicketsParams = {}) => {
  const queryClient = useQueryClient();

  const ticketsQuery = useQuery({
    queryKey: ['support-tickets', params],
    queryFn: async (): Promise<GetTicketsResponse> => {
      const queryParams = new URLSearchParams();
      if (params.status) queryParams.set('status', params.status);
      if (params.category) queryParams.set('category', params.category);
      if (params.priority) queryParams.set('priority', params.priority);
      if (params.page) queryParams.set('page', params.page.toString());
      if (params.limit) queryParams.set('limit', params.limit.toString());
      if (params.search) queryParams.set('search', params.search);

      const { data: result, error: fetchError } = await supabase.functions.invoke(
        `get-support-tickets?${queryParams.toString()}`
      );

      if (fetchError) throw new Error(fetchError.message);
      return result;
    },
    staleTime: 30000,
  });

  const createTicketMutation = useMutation({
    mutationFn: async ({ subject, category, message, imageUrl }: { 
      subject: string; 
      category: TicketCategory; 
      message: string;
      imageUrl?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('create-support-ticket', {
        body: { subject, category, message, image_url: imageUrl },
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Help request sent!');
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send help request');
    },
  });

  return {
    tickets: ticketsQuery.data?.tickets || [],
    total: ticketsQuery.data?.total || 0,
    stats: ticketsQuery.data?.stats || null,
    isAdmin: ticketsQuery.data?.isAdmin || false,
    isLoading: ticketsQuery.isLoading,
    isError: ticketsQuery.isError,
    error: ticketsQuery.error,
    refetch: ticketsQuery.refetch,
    createTicket: createTicketMutation.mutate,
    isCreating: createTicketMutation.isPending,
  };
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Waiting for help',
  in_progress: 'Someone is helping',
  waiting_user: 'Needs your reply',
  resolved: 'Problem solved',
  closed: 'All done',
};

export const STATUS_COLORS: Record<TicketStatus, string> = {
  open: 'bg-warning/15 text-warning border border-warning/30',
  in_progress: 'bg-info/15 text-info border border-info/30',
  waiting_user: 'bg-primary/15 text-primary border border-primary/30',
  resolved: 'bg-success/15 text-success border border-success/30',
  closed: 'bg-muted text-muted-foreground border border-border',
};

export const CATEGORY_COLORS: Record<TicketCategory, string> = {
  money_issue: 'bg-success/15 text-success',
  account_problem: 'bg-info/15 text-info',
  how_to_use: 'bg-primary/15 text-primary',
  complaint: 'bg-destructive/15 text-destructive',
  suggestion: 'bg-warning/15 text-warning',
  other: 'bg-muted text-muted-foreground',
};

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  money_issue: 'Money problem',
  account_problem: 'Account issue',
  how_to_use: 'How do I...',
  complaint: 'Complaint',
  suggestion: 'Feedback',
  other: 'Something else',
};

export const CATEGORY_ICONS = {
  money_issue: Wallet,
  account_problem: User,
  how_to_use: HelpCircle,
  complaint: AlertOctagon,
  suggestion: MessageSquare,
  other: ListTodo,
};
