REVOKE UPDATE ON public.ticket_messages FROM authenticated;
GRANT UPDATE (read_at) ON public.ticket_messages TO authenticated;
GRANT UPDATE ON public.ticket_messages TO service_role;