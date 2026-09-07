ALTER TABLE public.platform_config
ADD COLUMN IF NOT EXISTS max_auto_buys_per_pulse integer NOT NULL DEFAULT 1;