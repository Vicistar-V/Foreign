
-- Update Victor Chiemerie's cached balance to 900 earnings
UPDATE cached_balances
SET earnings_balance = 900, last_updated = NOW()
WHERE user_id = 'b23d5dd6-3f5d-49a7-8ad9-62a1feb17dc2';
