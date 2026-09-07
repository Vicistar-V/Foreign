-- Add email master switch to platform_config
ALTER TABLE platform_config
ADD COLUMN emails_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN platform_config.emails_enabled IS 'Master switch: When true, emails are sent. When false, only in-app notifications work.';