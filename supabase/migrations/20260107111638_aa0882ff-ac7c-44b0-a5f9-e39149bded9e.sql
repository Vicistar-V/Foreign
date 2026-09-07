-- Clean up broken transactions with invalid 'system' wallet_type
-- These were created by the bugged distribute_liquidity function

DELETE FROM transactions 
WHERE wallet_type::text = 'system';