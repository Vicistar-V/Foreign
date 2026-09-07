-- Add withdrawals_enabled column to platform_config for emergency withdrawal kill switch
ALTER TABLE platform_config 
ADD COLUMN IF NOT EXISTS withdrawals_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN platform_config.withdrawals_enabled IS 'Emergency kill switch: set to false to disable all withdrawals platform-wide';