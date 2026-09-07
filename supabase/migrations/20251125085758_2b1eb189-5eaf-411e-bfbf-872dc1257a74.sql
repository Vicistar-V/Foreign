-- Add withdrawal_fee column to platform_config
ALTER TABLE platform_config 
ADD COLUMN withdrawal_fee numeric NOT NULL DEFAULT 50;

COMMENT ON COLUMN platform_config.withdrawal_fee IS 'Fee charged per withdrawal in naira. This covers bank transfer costs and is deducted from the withdrawal amount.';