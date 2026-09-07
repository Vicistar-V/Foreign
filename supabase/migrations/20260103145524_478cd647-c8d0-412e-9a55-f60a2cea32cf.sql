-- Add rigged_mode column to platform_config for Ghost Mode distribution
ALTER TABLE public.platform_config 
ADD COLUMN IF NOT EXISTS rigged_mode BOOLEAN NOT NULL DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN public.platform_config.rigged_mode IS 'When true, distribution gives all winnings to test users and 100% refunds to real users';