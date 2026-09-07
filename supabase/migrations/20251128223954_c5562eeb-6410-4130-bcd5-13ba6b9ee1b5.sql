-- Add metadata column to profiles table for storing admin preferences
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;