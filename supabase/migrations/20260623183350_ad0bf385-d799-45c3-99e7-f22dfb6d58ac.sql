ALTER TABLE public.platform_config
ADD COLUMN IF NOT EXISTS ai_support_enabled boolean NOT NULL DEFAULT true;