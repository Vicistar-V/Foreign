-- Fix Vivian's Phantom Money Bug
-- Problem: Failed withdrawals created debt_reversal transactions even though
-- the original withdrawal was 'pending' (never deducted from balance)
-- This created phantom money in her account

-- Step 1: Delete the 3 phantom debt_reversal transactions (₦3,400 total)
DELETE FROM transactions 
WHERE id IN (
  '196e310a-eb55-48f5-b516-498efe22c63b',  -- +1200 reversal
  '481c541d-e805-443a-ae2a-6dc9dd983237',  -- +1200 reversal  
  'fa2d7e35-71e2-4a6c-a005-e5b4015be7e9'   -- +1000 reversal
);

-- Step 2: Delete the 3 platform fees for failed withdrawals (₦150 total)
DELETE FROM transactions
WHERE id IN (
  '50a22c47-2c9d-4d06-b949-26082a75acb2',  -- ₦50 fee
  'a81ccdc1-4526-4343-be4b-73774c88a766',  -- ₦50 fee
  'bea46111-6194-423a-a267-ddbb44477351'   -- ₦50 fee
);

-- Step 3: Invalidate Vivian's cached balance to force recalculation
DELETE FROM cached_balances 
WHERE user_id = 'dae463a3-767c-46fe-bed7-a9d27f9a4548';

-- Step 4: Notify Vivian about the correction
INSERT INTO notifications (user_id, notification_type, title, message)
VALUES (
  'dae463a3-767c-46fe-bed7-a9d27f9a4548',
  'system',
  'Balance Correction',
  'Your account balance has been corrected due to a system error with failed withdrawals. Your true balance now reflects your actual earnings.'
);