-- Update Lucky Spin cost from ₦200 to ₦150
UPDATE platform_config 
SET lucky_spin_cost = 150, updated_at = now()
WHERE id = 1;