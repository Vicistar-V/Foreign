-- Clean up redundant pay_user_profit functions and fix Chinedu's payout

-- Drop the obsolete 3-parameter versions (not used by distribute_liquidity)
DROP FUNCTION IF EXISTS pay_user_profit(UUID, NUMERIC, BOOLEAN);
DROP FUNCTION IF EXISTS pay_user_profit(UUID, UUID, BOOLEAN);

-- Update Chinedu's transaction from ₦400 to ₦900 (he had no referrer)
UPDATE transactions
SET amount = 900,
    description = 'Your earnings from drop cycle (corrected - no referrer)'
WHERE id = '5243a3ef-db78-48ff-897c-67d6dc9e909e';

-- Refresh Chinedu's cached balance
SELECT refresh_user_cache('f73e5c41-41cf-4a8a-a64c-1d4aacf5e4f3');