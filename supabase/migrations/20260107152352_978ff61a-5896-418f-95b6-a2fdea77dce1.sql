-- 1. Disconnect Vivian Ikechi Wike from being referred by Victor Ogazie
UPDATE profiles 
SET referred_by_code = NULL 
WHERE id = 'dae463a3-767c-46fe-bed7-a9d27f9a4548';

-- 2. Delete the ₦20 referral cycle payout from Victor Ogazie
DELETE FROM transactions 
WHERE id = '2b944c33-e0d3-472c-bd30-d2e3d6a8ddb6';

-- 3. Credit SYSTEM_TREASURY back the ₦20 (reverse the loss)
INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'earnings',
  20,
  'platform_fee',
  'Correction: Reversed incorrect referral cycle payout',
  'completed'
);