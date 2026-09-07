-- =====================================================
-- 1. Create storage bucket for ticket attachments
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 2. Add image_url column to ticket_messages
-- =====================================================
ALTER TABLE public.ticket_messages 
ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

-- =====================================================
-- 3. Storage RLS Policies
-- =====================================================

-- Users can upload to their own folder
CREATE POLICY "Users can upload ticket attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can view their own attachments
CREATE POLICY "Users can view own ticket attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ticket-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can view all attachments
CREATE POLICY "Admins can view all ticket attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ticket-attachments' AND
  public.has_role(auth.uid(), 'admin')
);

-- Admins can upload attachments (to any folder)
CREATE POLICY "Admins can upload ticket attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-attachments' AND
  public.has_role(auth.uid(), 'admin')
);