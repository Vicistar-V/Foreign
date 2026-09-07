-- Update all drops with target_amount = 1500 to use the correct 2000
UPDATE drops
SET target_amount = 2000
WHERE target_amount = 1500;