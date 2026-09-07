-- Add avatar_url column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 
  'avatars', 
  true,
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: Users can upload their own avatar
CREATE POLICY "Users can upload own avatar" 
ON storage.objects
FOR INSERT 
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS policy: Users can update their own avatar
CREATE POLICY "Users can update own avatar" 
ON storage.objects
FOR UPDATE 
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS policy: Users can delete their own avatar
CREATE POLICY "Users can delete own avatar" 
ON storage.objects
FOR DELETE 
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS policy: Anyone can view avatars (public bucket)
CREATE POLICY "Avatars are publicly viewable" 
ON storage.objects
FOR SELECT 
USING (bucket_id = 'avatars');