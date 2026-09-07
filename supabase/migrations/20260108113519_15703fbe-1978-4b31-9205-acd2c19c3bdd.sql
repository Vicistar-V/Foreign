-- Genesis Migration: Activate Genesis for existing single-spot users

-- 1. Mark Joel Simeon's spot as Genesis (hasn't cycled yet)
UPDATE spots 
SET is_genesis_spot = true, 
    genesis_yields_remaining = 3
WHERE user_id = '2319ceab-abe7-4c66-b222-a97e9c297e5b'
  AND is_genesis_spot = false;

-- 2. Move Abubakar Ishaq's ₦400 from earnings to deposit
INSERT INTO transactions (user_id, amount, transaction_type, wallet_type, description, status)
VALUES 
  ('76c346ab-5ae4-4835-8202-180ebd9df801', -400, 'genesis_transfer', 'earnings', 'Genesis migration - moving to deposit', 'completed'),
  ('76c346ab-5ae4-4835-8202-180ebd9df801', 400, 'genesis_transfer', 'deposit', 'Genesis migration - building your second machine', 'completed');

-- Update his genesis_yields_remaining (already cycled once, 2 more to go)
UPDATE spots 
SET genesis_yields_remaining = 2
WHERE user_id = '76c346ab-5ae4-4835-8202-180ebd9df801' AND is_genesis_spot = true;

-- 3. Move Samuel Nnadozie's ₦400 from earnings to deposit
INSERT INTO transactions (user_id, amount, transaction_type, wallet_type, description, status)
VALUES 
  ('836c1d66-1053-45d4-ac4c-a5d76ba58f90', -400, 'genesis_transfer', 'earnings', 'Genesis migration - moving to deposit', 'completed'),
  ('836c1d66-1053-45d4-ac4c-a5d76ba58f90', 400, 'genesis_transfer', 'deposit', 'Genesis migration - building your second machine', 'completed');

-- Update his genesis_yields_remaining (already cycled once, 2 more to go)
UPDATE spots 
SET genesis_yields_remaining = 2
WHERE user_id = '836c1d66-1053-45d4-ac4c-a5d76ba58f90' AND is_genesis_spot = true;

-- 4. Move Adefisayo Olayemi's ₦800 from earnings to deposit
INSERT INTO transactions (user_id, amount, transaction_type, wallet_type, description, status)
VALUES 
  ('647b68e1-7a74-4f8a-8232-ad7d3f152705', -800, 'genesis_transfer', 'earnings', 'Genesis migration - moving to deposit', 'completed'),
  ('647b68e1-7a74-4f8a-8232-ad7d3f152705', 800, 'genesis_transfer', 'deposit', 'Genesis migration - building your second machine', 'completed');

-- Update his genesis_yields_remaining (already cycled twice, 1 more to go)
UPDATE spots 
SET genesis_yields_remaining = 1
WHERE user_id = '647b68e1-7a74-4f8a-8232-ad7d3f152705' AND is_genesis_spot = true;

-- 5. Move Chiemerie David's ₦800 from earnings to deposit
INSERT INTO transactions (user_id, amount, transaction_type, wallet_type, description, status)
VALUES 
  ('8e46e5a3-e4a5-4e44-a0d6-7feaffa61c76', -800, 'genesis_transfer', 'earnings', 'Genesis migration - moving to deposit', 'completed'),
  ('8e46e5a3-e4a5-4e44-a0d6-7feaffa61c76', 800, 'genesis_transfer', 'deposit', 'Genesis migration - building your second machine', 'completed');

-- Update his genesis_yields_remaining (already cycled twice, 1 more to go)
UPDATE spots 
SET genesis_yields_remaining = 1
WHERE user_id = '8e46e5a3-e4a5-4e44-a0d6-7feaffa61c76' AND is_genesis_spot = true;

-- 6. Fix Vivian Ikechi Wike - she has ₦1,650 and genesis marked complete but only 1 spot
-- Reset her genesis_completed_at first
UPDATE profiles 
SET genesis_completed_at = NULL
WHERE id = 'dae463a3-767c-46fe-bed7-a9d27f9a4548';

-- Move ₦1,200 from earnings to deposit (simulating 3 genesis yields)
INSERT INTO transactions (user_id, amount, transaction_type, wallet_type, description, status)
VALUES 
  ('dae463a3-767c-46fe-bed7-a9d27f9a4548', -1200, 'genesis_transfer', 'earnings', 'Genesis migration - building Machine 2', 'completed'),
  ('dae463a3-767c-46fe-bed7-a9d27f9a4548', 1200, 'genesis_transfer', 'deposit', 'Genesis migration - Machine 2 funding', 'completed');

-- Set her genesis_yields_remaining to 0 (ready to complete on next check)
UPDATE spots 
SET genesis_yields_remaining = 0
WHERE user_id = 'dae463a3-767c-46fe-bed7-a9d27f9a4548' AND is_genesis_spot = true;

-- 7. Mark Chinedu Joseph's genesis as complete (already has 2+ spots)
UPDATE profiles 
SET genesis_completed_at = now()
WHERE id = 'f73e5c41-41cf-4a8a-a64c-1d4aacf5e4f3'
  AND genesis_completed_at IS NULL;