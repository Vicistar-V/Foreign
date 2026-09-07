-- Step 1: Fund SYSTEM_TREASURY with ₦10,000 marketing budget
INSERT INTO transactions (
  user_id,
  wallet_type,
  amount,
  transaction_type,
  description,
  status,
  metadata
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'earnings',
  10000,
  'deposit',
  'Marketing budget injection - Pool seeding Day 1 Batch 4',
  'completed',
  '{"purpose": "pool_seeding", "batch": 4, "day": 1}'::jsonb
);

-- Step 2: Update minimum pool guarantee to ₦10,000
UPDATE platform_config 
SET minimum_pool_guarantee = 10000, updated_at = now() 
WHERE id = 1;