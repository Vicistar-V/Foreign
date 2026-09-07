-- Add telegram_alerts_enabled to platform_config
ALTER TABLE public.platform_config
ADD COLUMN IF NOT EXISTS telegram_alerts_enabled BOOLEAN NOT NULL DEFAULT true;

-- Add comment for clarity
COMMENT ON COLUMN public.platform_config.telegram_alerts_enabled IS 'Enable/disable Telegram admin notifications for signups and activations';