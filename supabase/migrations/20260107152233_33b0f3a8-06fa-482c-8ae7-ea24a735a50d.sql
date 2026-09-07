-- Clean up historical double-dip: Delete the incorrectly credited membership_fee and drop_entry transactions
-- These ₦2,000 total were incorrectly kept in SYSTEM_TREASURY when users should have received them in their deposit wallet

DELETE FROM transactions 
WHERE user_id = '00000000-0000-0000-0000-000000000000'
  AND transaction_type IN ('membership_fee', 'drop_entry')
  AND amount = 1000
  AND id IN (
    '79e9b8d3-3d92-4a21-a693-f646a2069e66',  -- Legacy member spot purchase ₦1,000
    '30754886-66fb-4eed-a174-46f399288466'   -- Membership fee ₦1,000
  );