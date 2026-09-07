
-- =====================================================
-- RESET TEST USER FOR GENESIS COMPLETE TESTING
-- Non-Admin: 15980d55-ca66-44f9-b8e2-6fb26fa74179
-- Admin (Referrer): 5d7a5ea2-034c-4665-86b6-816d81dc0330
-- =====================================================

-- Step 1: Delete all drops for non-admin's spots
DELETE FROM drops 
WHERE spot_id IN (
  SELECT id FROM spots WHERE user_id = '15980d55-ca66-44f9-b8e2-6fb26fa74179'
);

-- Step 2: Delete all spots for non-admin
DELETE FROM spots 
WHERE user_id = '15980d55-ca66-44f9-b8e2-6fb26fa74179';

-- Step 3: Delete all drop-related transactions for non-admin
DELETE FROM transactions 
WHERE user_id = '15980d55-ca66-44f9-b8e2-6fb26fa74179'
  AND transaction_type IN ('drop_entry', 'drop_profit', 'drop_reentry', 'drop_referral_cycle');

-- Step 4: Set non-admin's referrer to admin's referral code
UPDATE profiles 
SET 
  referred_by_code = 'victorogazie',
  genesis_completed_at = NULL,
  auto_compound_enabled = true
WHERE id = '15980d55-ca66-44f9-b8e2-6fb26fa74179';

-- Step 5: Reset cached balances for non-admin
UPDATE cached_balances 
SET 
  deposit_balance = (
    SELECT COALESCE(SUM(amount), 0) 
    FROM transactions 
    WHERE user_id = '15980d55-ca66-44f9-b8e2-6fb26fa74179' 
      AND wallet_type = 'deposit' 
      AND status = 'completed'
  ),
  earnings_balance = (
    SELECT COALESCE(SUM(amount), 0) 
    FROM transactions 
    WHERE user_id = '15980d55-ca66-44f9-b8e2-6fb26fa74179' 
      AND wallet_type = 'earnings' 
      AND status = 'completed'
  ),
  last_updated = NOW()
WHERE user_id = '15980d55-ca66-44f9-b8e2-6fb26fa74179';
