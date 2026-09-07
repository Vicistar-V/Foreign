-- Add genesis_completed_at column to profiles table
ALTER TABLE public.profiles ADD COLUMN genesis_completed_at TIMESTAMPTZ;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.genesis_completed_at IS 'Timestamp when user completed their 3 genesis yields and built their 2nd machine';