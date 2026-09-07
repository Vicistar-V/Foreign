-- Clear all drop-related test data for fresh testing

-- First delete drops (depends on spots)
DELETE FROM drops;

-- Delete spots
DELETE FROM spots;

-- Delete pulse history
DELETE FROM drop_pulses;

-- Delete drop-related transactions
DELETE FROM transactions 
WHERE transaction_type IN ('drop_entry', 'drop_profit', 'drop_reentry', 'drop_referral_cycle');

-- Reset cached balances for affected users (recalculate will happen on next query)
DELETE FROM cached_balances;