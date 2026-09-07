-- UNDO TEST DISTRIBUTION: Reverse all changes from Victor's test purchase

-- Step 1: Delete the 3 test transactions
DELETE FROM transactions WHERE id IN (
  '95b22c5e-f657-45dc-9dcf-16ef1129be87',  -- Victor's drop_entry -₦1,000
  'bd0daecb-36c9-433b-bbcb-de4673746404',  -- Joel's genesis_yield +₦900
  '1be8f734-3f13-40a0-87da-5683584e84ea'   -- Platform fee +₦100
);

-- Step 2: Delete Joel's re-entry drop (position 58)
DELETE FROM drops WHERE id = 'fe162c32-f691-417c-9815-aafd6cc2c71c';

-- Step 3: Delete Victor's new drop (position 57) and spot
DELETE FROM drops WHERE spot_id = '50665d08-62a3-4c1d-8320-d4e60d54ee34';
DELETE FROM spots WHERE id = '50665d08-62a3-4c1d-8320-d4e60d54ee34';

-- Step 4: Reset Joel's filled drop back to waiting state
UPDATE drops 
SET status = 'waiting', 
    fill_amount = 0, 
    paid_at = NULL,
    completed_at = NULL
WHERE id = 'cb6512ae-51c0-4065-94b9-f4f12836cfba';

-- Step 5: Reset Joel's spot statistics
UPDATE spots 
SET genesis_yields_remaining = 2,
    total_cycles = 1,
    total_earnings = 400
WHERE id = '7b3fe7e2-71af-49e8-a4d9-c7201f86bdc9';

-- Step 6: Recalculate cached_balances for affected users

-- Joel Simeon (genesis user) - correct UUID
UPDATE cached_balances SET 
  deposit_balance = 400,
  earnings_balance = 0,
  last_updated = now()
WHERE user_id = '2319ceab-abe7-4c66-b222-a97e9c297e5b';

-- Victor Chiemerie
UPDATE cached_balances SET 
  deposit_balance = (
    SELECT COALESCE(SUM(CASE WHEN transaction_type IN ('deposit', 'drop_profit', 'genesis_yield', 'referral_payout', 'referral_first_cycle_bonus', 'welcome_bonus', 'membership_bonus') THEN amount ELSE -amount END), 0)
    FROM transactions 
    WHERE user_id = '9aa7d32a-f04d-4ebf-83f5-b27de8be10b4' 
    AND wallet_type = 'deposit' 
    AND status = 'completed'
  ),
  earnings_balance = (
    SELECT COALESCE(SUM(CASE WHEN transaction_type IN ('deposit', 'drop_profit', 'genesis_yield', 'referral_payout', 'referral_first_cycle_bonus', 'welcome_bonus', 'membership_bonus') THEN amount ELSE -amount END), 0)
    FROM transactions 
    WHERE user_id = '9aa7d32a-f04d-4ebf-83f5-b27de8be10b4' 
    AND wallet_type = 'earnings' 
    AND status = 'completed'
  ),
  last_updated = now()
WHERE user_id = '9aa7d32a-f04d-4ebf-83f5-b27de8be10b4';

-- SYSTEM_TREASURY
UPDATE cached_balances SET 
  earnings_balance = (
    SELECT COALESCE(SUM(CASE WHEN transaction_type IN ('platform_fee', 'membership_fee') THEN amount ELSE -amount END), 0)
    FROM transactions 
    WHERE user_id = '00000000-0000-0000-0000-000000000000'
    AND status = 'completed'
  ),
  last_updated = now()
WHERE user_id = '00000000-0000-0000-0000-000000000000';

-- Step 7: Delete any notifications from the test (last 15 minutes)
DELETE FROM notifications 
WHERE created_at > now() - interval '15 minutes'
AND user_id IN ('2319ceab-abe7-4c66-b222-a97e9c297e5b', '9aa7d32a-f04d-4ebf-83f5-b27de8be10b4');