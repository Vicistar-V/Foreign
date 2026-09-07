ALTER TABLE public.spots
  DROP COLUMN IF EXISTS is_genesis_spot,
  DROP COLUMN IF EXISTS genesis_yields_remaining;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS genesis_completed_at;