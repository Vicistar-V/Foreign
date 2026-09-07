-- Add read tracking column to event_queue
ALTER TABLE public.event_queue ADD COLUMN read_at TIMESTAMPTZ DEFAULT NULL;

-- RLS Policy: Users can view their own notifications
CREATE POLICY "Users can view own notifications"
ON public.event_queue FOR SELECT
USING (auth.uid() = user_id);

-- RLS Policy: Users can mark their own notifications as read
CREATE POLICY "Users can mark own notifications read"
ON public.event_queue FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);