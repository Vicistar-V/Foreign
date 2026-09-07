-- Reset SYSTEM_TREASURY by deleting all its transactions
-- The trigger will automatically recalculate balance to 0

DELETE FROM transactions 
WHERE user_id = '00000000-0000-0000-0000-000000000000';