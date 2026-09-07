-- RESET ALL TRANSACTION DATA (Clean Slate)
-- Keep user accounts and membership status

-- 1. Clear drops first (references spots)
DELETE FROM drops;

-- 2. Clear spots
DELETE FROM spots;

-- 3. Clear all transactions
DELETE FROM transactions;

-- 4. Clear pulse history
DELETE FROM drop_pulses;

-- 5. Reset cached balances to 0 for all users
UPDATE cached_balances 
SET deposit_balance = 0, 
    earnings_balance = 0, 
    last_updated = now();