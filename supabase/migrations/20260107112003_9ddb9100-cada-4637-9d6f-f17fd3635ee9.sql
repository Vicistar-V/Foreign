-- Delete broken SYSTEM_TREASURY drop_entry transactions
-- These were incorrectly created by an older version of create_spot
DELETE FROM transactions 
WHERE user_id = '00000000-0000-0000-0000-000000000000'
  AND transaction_type = 'drop_entry';