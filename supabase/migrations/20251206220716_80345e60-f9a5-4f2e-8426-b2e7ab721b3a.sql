-- =====================================================
-- RESET ALL TEST DATA
-- This cleans up all mock/test transactions and entries
-- while preserving the SYSTEM_TREASURY profile
-- =====================================================

-- Step 1: Clear all transactions (this will also reset user_balances via trigger)
DELETE FROM transactions;

-- Step 2: Clear all drop entries
DELETE FROM drop_entries;

-- Step 3: Clear all daily drop logs
DELETE FROM daily_drop_logs;

-- Step 4: Clear all notifications/events
DELETE FROM event_queue;

-- Step 5: Clear withdrawal accounts
DELETE FROM withdrawal_accounts;

-- Step 6: Clear webhook logs
DELETE FROM webhook_logs;

-- Step 7: Clear system alerts
DELETE FROM system_alerts;

-- Step 8: Clear user_balances cache (will be rebuilt from transactions)
DELETE FROM user_balances;

-- Step 9: Delete test user profiles (keep SYSTEM_TREASURY)
DELETE FROM profiles WHERE id != '00000000-0000-0000-0000-000000000000';

-- Step 10: Delete user roles for test users (keep admin roles for SYSTEM if any)
DELETE FROM user_roles WHERE user_id != '00000000-0000-0000-0000-000000000000';

-- Step 11: Reinitialize SYSTEM_TREASURY balance to 0
INSERT INTO user_balances (user_id, earnings_balance, deposit_balance, credits_balance)
VALUES ('00000000-0000-0000-0000-000000000000', 0, 0, 0)
ON CONFLICT (user_id) DO UPDATE SET 
  earnings_balance = 0,
  deposit_balance = 0,
  credits_balance = 0,
  last_updated = now();