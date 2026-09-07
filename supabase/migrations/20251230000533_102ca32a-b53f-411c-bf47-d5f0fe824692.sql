-- ============================================
-- SUPPORT TICKET SYSTEM
-- ============================================

-- Create enum for ticket status
CREATE TYPE public.ticket_status AS ENUM (
  'open',           -- Waiting for Help
  'in_progress',    -- Someone is Helping
  'waiting_user',   -- We Need Your Reply
  'resolved',       -- Problem Solved
  'closed'          -- Done
);

-- Create enum for ticket category
CREATE TYPE public.ticket_category AS ENUM (
  'money_issue',      -- Money Problem
  'account_problem',  -- Account Issue
  'how_to_use',       -- How Do I...
  'complaint',        -- Complaint
  'suggestion',       -- Feedback
  'other'             -- Something Else
);

-- Create enum for ticket priority
CREATE TYPE public.ticket_priority AS ENUM (
  'normal',
  'urgent'
);

-- Create enum for sender type in messages
CREATE TYPE public.ticket_sender_type AS ENUM (
  'user',
  'admin'
);

-- ============================================
-- SUPPORT TICKETS TABLE
-- ============================================
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  category public.ticket_category NOT NULL DEFAULT 'other',
  status public.ticket_status NOT NULL DEFAULT 'open',
  priority public.ticket_priority NOT NULL DEFAULT 'normal',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index for faster queries
CREATE INDEX idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_created_at ON public.support_tickets(created_at DESC);
CREATE INDEX idx_support_tickets_priority ON public.support_tickets(priority);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_tickets
-- Users can view their own tickets
CREATE POLICY "Users can view their own tickets"
ON public.support_tickets
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own tickets
CREATE POLICY "Users can create their own tickets"
ON public.support_tickets
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all tickets
CREATE POLICY "Admins can view all tickets"
ON public.support_tickets
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update all tickets
CREATE POLICY "Admins can update all tickets"
ON public.support_tickets
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role can manage all tickets"
ON public.support_tickets
FOR ALL
USING (auth.role() = 'service_role');

-- ============================================
-- TICKET MESSAGES TABLE
-- ============================================
CREATE TABLE public.ticket_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_type public.ticket_sender_type NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index for faster queries
CREATE INDEX idx_ticket_messages_ticket_id ON public.ticket_messages(ticket_id);
CREATE INDEX idx_ticket_messages_created_at ON public.ticket_messages(created_at);
CREATE INDEX idx_ticket_messages_sender_id ON public.ticket_messages(sender_id);

-- Enable RLS
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ticket_messages
-- Users can view messages for their own tickets
CREATE POLICY "Users can view messages on their tickets"
ON public.ticket_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets
    WHERE id = ticket_messages.ticket_id
    AND user_id = auth.uid()
  )
);

-- Users can add messages to their own tickets
CREATE POLICY "Users can add messages to their tickets"
ON public.ticket_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.support_tickets
    WHERE id = ticket_messages.ticket_id
    AND user_id = auth.uid()
  )
  AND sender_type = 'user'
  AND sender_id = auth.uid()
);

-- Users can mark messages as read on their tickets
CREATE POLICY "Users can mark messages read on their tickets"
ON public.ticket_messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets
    WHERE id = ticket_messages.ticket_id
    AND user_id = auth.uid()
  )
);

-- Admins can view all messages
CREATE POLICY "Admins can view all messages"
ON public.ticket_messages
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can insert messages
CREATE POLICY "Admins can insert messages"
ON public.ticket_messages
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can update messages
CREATE POLICY "Admins can update messages"
ON public.ticket_messages
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Service role can do everything
CREATE POLICY "Service role can manage all messages"
ON public.ticket_messages
FOR ALL
USING (auth.role() = 'service_role');

-- ============================================
-- TRIGGER: Auto-update updated_at on tickets
-- ============================================
CREATE OR REPLACE FUNCTION public.update_ticket_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_ticket_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ticket_updated_at();

-- ============================================
-- TRIGGER: Update ticket's updated_at when new message added
-- ============================================
CREATE OR REPLACE FUNCTION public.update_ticket_on_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the ticket's updated_at
  UPDATE public.support_tickets
  SET updated_at = now()
  WHERE id = NEW.ticket_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_ticket_on_message
  AFTER INSERT ON public.ticket_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ticket_on_new_message();

-- ============================================
-- Add new event types for notifications
-- ============================================
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'ticket_created';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'ticket_reply';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'ticket_resolved';