ALTER TABLE public.platform_config ADD COLUMN IF NOT EXISTS invite_access_key text;
UPDATE public.platform_config SET invite_access_key = encode(gen_random_bytes(6), 'hex') WHERE id = 1 AND (invite_access_key IS NULL OR invite_access_key = '');
ALTER TABLE public.platform_config ALTER COLUMN invite_access_key SET NOT NULL;
ALTER TABLE public.platform_config ALTER COLUMN invite_access_key SET DEFAULT encode(gen_random_bytes(6), 'hex');