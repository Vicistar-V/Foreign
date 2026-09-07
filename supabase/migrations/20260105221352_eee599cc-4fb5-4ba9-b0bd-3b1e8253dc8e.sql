-- Enable real-time updates for drops table
-- This allows WebSocket subscriptions instead of polling

-- Set REPLICA IDENTITY to FULL so we get complete row data on updates
ALTER TABLE public.drops REPLICA IDENTITY FULL;

-- Add drops table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.drops;

-- Also enable for spots table (for status changes)
ALTER TABLE public.spots REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.spots;