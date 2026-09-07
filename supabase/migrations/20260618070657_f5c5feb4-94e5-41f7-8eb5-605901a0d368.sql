-- Allow users to upload their own session replay chunks
CREATE POLICY "Users upload own replay chunks"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'session-replays'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users update own replay chunks"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'session-replays'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can read every replay chunk for playback
CREATE POLICY "Admins read all replay chunks"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'session-replays'
  AND has_role(auth.uid(), 'admin'::app_role)
);