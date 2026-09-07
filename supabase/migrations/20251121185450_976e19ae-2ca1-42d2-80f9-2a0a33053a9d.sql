-- Create banks table for caching Flutterwave bank list
CREATE TABLE IF NOT EXISTS public.banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'NG',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_banks_country ON public.banks(country);
CREATE INDEX IF NOT EXISTS idx_banks_code ON public.banks(code);

-- Enable RLS
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read banks (no auth required)
CREATE POLICY "Anyone can view banks"
  ON public.banks FOR SELECT
  USING (true);

-- Only service role can modify (for sync-banks edge function)
CREATE POLICY "Service role can modify banks"
  ON public.banks FOR ALL
  USING (auth.role() = 'service_role');