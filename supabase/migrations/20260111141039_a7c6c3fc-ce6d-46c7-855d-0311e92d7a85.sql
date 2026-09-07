-- Fix drops with wrong target_amount (1500 should be 2000)
-- Only update drops that haven't been completed yet
UPDATE drops 
SET target_amount = 2000 
WHERE target_amount = 1500 
  AND status IN ('waiting', 'filling');

-- Update the column default to match platform_config.drop_target_amount
ALTER TABLE drops 
ALTER COLUMN target_amount SET DEFAULT 2000;