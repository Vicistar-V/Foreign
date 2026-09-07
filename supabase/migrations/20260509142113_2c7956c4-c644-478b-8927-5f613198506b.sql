-- Make user ticket-message updates read-status-only.
DROP POLICY IF EXISTS "Users can mark messages read on their tickets" ON public.ticket_messages;

CREATE POLICY "Users can only mark messages read on their tickets"
ON public.ticket_messages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.support_tickets
    WHERE support_tickets.id = ticket_messages.ticket_id
      AND support_tickets.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.support_tickets
    WHERE support_tickets.id = ticket_messages.ticket_id
      AND support_tickets.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.keep_ticket_message_details_safe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.ticket_id IS DISTINCT FROM OLD.ticket_id
    OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
    OR NEW.sender_type IS DISTINCT FROM OLD.sender_type
    OR NEW.message IS DISTINCT FROM OLD.message
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.metadata IS DISTINCT FROM OLD.metadata
    OR NEW.image_url IS DISTINCT FROM OLD.image_url THEN
    RAISE EXCEPTION 'Only the read status can be changed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS keep_ticket_message_details_safe ON public.ticket_messages;
CREATE TRIGGER keep_ticket_message_details_safe
BEFORE UPDATE ON public.ticket_messages
FOR EACH ROW
EXECUTE FUNCTION public.keep_ticket_message_details_safe();

-- Remove leftover policies for deleted/unregistered storage buckets.
DROP POLICY IF EXISTS "Admins can delete task media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload task media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view task media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view mission proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own mission proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload mission proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own mission proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all mission proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own mission proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload task media" ON storage.objects;
DROP POLICY IF EXISTS "Users can view task media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all task media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own task media" ON storage.objects;