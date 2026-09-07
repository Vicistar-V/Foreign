import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TicketStatus, TicketPriority, TicketCategory } from './useSupportTickets';

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_type: 'user' | 'admin' | 'ai';
  message: string;
  image_url?: string | null;
  created_at: string;
  read_at: string | null;
  metadata: Record<string, unknown>;
  sender?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export interface TicketDetail {
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
    is_member: boolean;
    is_banned: boolean;
    created_at: string;
  };
  resolver?: {
    id: string;
    full_name: string;
  };
}

interface GetTicketDetailResponse {
  ticket: TicketDetail;
  messages: TicketMessage[];
  isAdmin: boolean;
}

export const useTicketDetail = (ticketId: string | null) => {
  const queryClient = useQueryClient();

  const ticketQuery = useQuery({
    queryKey: ['ticket-detail', ticketId],
    queryFn: async (): Promise<GetTicketDetailResponse> => {
      if (!ticketId) throw new Error('No ticket ID');

      const { data, error } = await supabase.functions.invoke(
        `get-ticket-detail?ticket_id=${ticketId}`
      );

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      return data;
    },
    enabled: !!ticketId,
    staleTime: 3000,
    // Realtime drives most updates; a slow background poll catches missed events.
    refetchInterval: 20000,
  });

  // ----- Realtime: instant message + ticket status updates -----
  // Patches the cache in place using the realtime payload — no refetch
  // round-trip per token. This is what makes streaming feel real.
  useEffect(() => {
    if (!ticketId) return;

    const channel = supabase
      .channel(`ticket-${ticketId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_messages', filter: `ticket_id=eq.${ticketId}` },
        (payload) => {
          const incoming = payload.new as TicketMessage;
          queryClient.setQueryData<GetTicketDetailResponse>(['ticket-detail', ticketId], (prev) => {
            if (!prev) return prev;
            // Replace any optimistic row of the same sender (same text within 5s) instead of duplicating.
            const withoutOptimistic = prev.messages.filter((m) => {
              if (!String(m.id).startsWith('optimistic-')) return true;
              if (m.sender_type !== incoming.sender_type) return true;
              if (m.message.trim() !== (incoming.message || '').trim()) return true;
              return false;
            });
            if (withoutOptimistic.some((m) => m.id === incoming.id)) return prev;
            return { ...prev, messages: [...withoutOptimistic, incoming] };
          });
          queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ticket_messages', filter: `ticket_id=eq.${ticketId}` },
        (payload) => {
          const updated = payload.new as TicketMessage;
          queryClient.setQueryData<GetTicketDetailResponse>(['ticket-detail', ticketId], (prev) => {
            if (!prev) return prev;
            let found = false;
            const next = prev.messages.map((m) => {
              if (m.id === updated.id) {
                found = true;
                return { ...m, ...updated };
              }
              return m;
            });
            if (!found) next.push(updated);
            return { ...prev, messages: next };
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'support_tickets', filter: `id=eq.${ticketId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['ticket-detail', ticketId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId, queryClient]);


  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, imageUrl }: { message: string; imageUrl?: string }) => {
      if (!ticketId) throw new Error('No ticket ID');

      const { data, error } = await supabase.functions.invoke('add-ticket-message', {
        body: { ticket_id: ticketId, message, image_url: imageUrl },
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      return data;
    },
    // ----- Optimistic UI: message shows instantly, no waiting for round-trip -----
    onMutate: async ({ message, imageUrl }) => {
      if (!ticketId) return;
      await queryClient.cancelQueries({ queryKey: ['ticket-detail', ticketId] });

      const prev = queryClient.getQueryData<GetTicketDetailResponse>(['ticket-detail', ticketId]);
      if (!prev) return { prev };

      const { data: { user } } = await supabase.auth.getUser();
      const senderType: 'user' | 'admin' = prev.isAdmin ? 'admin' : 'user';

      const optimisticMsg: TicketMessage = {
        id: `optimistic-${Date.now()}`,
        ticket_id: ticketId,
        sender_id: user?.id || '',
        sender_type: senderType,
        message: message,
        image_url: imageUrl || null,
        created_at: new Date().toISOString(),
        read_at: null,
        metadata: { optimistic: true },
        sender: {
          id: user?.id || '',
          full_name: prev.ticket.user?.full_name || 'You',
          avatar_url: prev.ticket.user?.avatar_url || null,
        },
      };

      queryClient.setQueryData<GetTicketDetailResponse>(['ticket-detail', ticketId], {
        ...prev,
        messages: [...prev.messages, optimisticMsg],
      });

      return { prev };
    },
    onError: (error: Error, _vars, ctx) => {
      if (ctx?.prev && ticketId) {
        queryClient.setQueryData(['ticket-detail', ticketId], ctx.prev);
      }
      toast.error(error.message || 'Failed to send message');
    },
    onSettled: () => {
      // Realtime will usually deliver the canonical row; this is a safety refetch.
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, priority }: { status?: TicketStatus; priority?: TicketPriority }) => {
      if (!ticketId) throw new Error('No ticket ID');

      const { data, error } = await supabase.functions.invoke('update-ticket-status', {
        body: { ticket_id: ticketId, status, priority },
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Updated!');
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update');
    },
  });

  return {
    ticket: ticketQuery.data?.ticket || null,
    messages: ticketQuery.data?.messages || [],
    isAdmin: ticketQuery.data?.isAdmin || false,
    isLoading: ticketQuery.isLoading,
    isError: ticketQuery.isError,
    error: ticketQuery.error,
    refetch: ticketQuery.refetch,
    sendMessage: sendMessageMutation.mutate,
    isSending: sendMessageMutation.isPending,
    updateStatus: updateStatusMutation.mutate,
    isUpdating: updateStatusMutation.isPending,
  };
};
