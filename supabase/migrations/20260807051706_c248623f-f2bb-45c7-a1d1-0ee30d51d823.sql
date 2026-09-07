ALTER TABLE public.platform_config
  ADD COLUMN IF NOT EXISTS explainer_video_url text,
  ADD COLUMN IF NOT EXISTS explainer_video_path text,
  ADD COLUMN IF NOT EXISTS explainer_video_poster_url text,
  ADD COLUMN IF NOT EXISTS explainer_video_poster_path text,
  ADD COLUMN IF NOT EXISTS explainer_video_aspect numeric,
  ADD COLUMN IF NOT EXISTS explainer_video_duration_seconds numeric,
  ADD COLUMN IF NOT EXISTS explainer_video_required_percent integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS explainer_video_updated_at timestamptz;

CREATE POLICY "Admins can read explainer video files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'explainer-video' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can upload explainer video files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'explainer-video' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can replace explainer video files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'explainer-video' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'explainer-video' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete explainer video files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'explainer-video' AND public.has_role(auth.uid(), 'admin'));