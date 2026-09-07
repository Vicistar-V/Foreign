-- Add banned status to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS banned_reason TEXT,
ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster banned user lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles(is_banned) WHERE is_banned = true;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.is_banned IS 'User is permanently banned (typically due to chargeback fraud)';
COMMENT ON COLUMN public.profiles.banned_reason IS 'Reason for ban (e.g., "Chargeback on membership fee")';
COMMENT ON COLUMN public.profiles.banned_at IS 'Timestamp when user was banned';