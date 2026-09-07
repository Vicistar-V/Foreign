-- Add minimum_pool_guarantee column to platform_config
ALTER TABLE platform_config 
ADD COLUMN minimum_pool_guarantee NUMERIC(12,2) NOT NULL DEFAULT 1000;

-- Update the existing row to set the default value
UPDATE platform_config 
SET minimum_pool_guarantee = 1000 
WHERE id = 1;