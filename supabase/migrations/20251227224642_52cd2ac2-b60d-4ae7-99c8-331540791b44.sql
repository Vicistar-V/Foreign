-- =====================================================
-- Add last_seen_at column to profiles for reliable heartbeat tracking
-- =====================================================

-- Add the new column with default value of now()
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create an index for efficient admin queries (filtering by activity status)
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at ON public.profiles(last_seen_at DESC);

-- Update existing profiles to set last_seen_at to their created_at date
-- This ensures no NULL values for existing users
UPDATE public.profiles 
SET last_seen_at = created_at 
WHERE last_seen_at IS NULL;