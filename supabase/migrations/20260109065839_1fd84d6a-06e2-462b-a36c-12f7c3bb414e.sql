-- Update all active drops to use the new ₦2,000 target amount
UPDATE drops 
SET target_amount = 2000 
WHERE status IN ('waiting', 'filling');