-- ROLLBACK: Undo all distributions after position 32 (Chiemerie's drop paid at 2026-01-10 20:44:19)

-- Step 1: Delete drops for spots created after cutoff
DELETE FROM drops 
WHERE spot_id IN (
  SELECT id FROM spots 
  WHERE created_at > '2026-01-10 20:44:19.084192+00'
);

-- Step 2: Delete spots created after cutoff
DELETE FROM spots 
WHERE created_at > '2026-01-10 20:44:19.084192+00';

-- Step 3: Reset drops at position 33+ to waiting state
UPDATE drops
SET 
  status = 'waiting',
  fill_amount = 0,
  paid_at = NULL,
  completed_at = NULL,
  is_settled = false
WHERE position > 32;

-- Step 4: Delete transactions after cutoff
DELETE FROM transactions
WHERE created_at > '2026-01-10 20:44:19.084192+00';

-- Step 5: Delete notifications after cutoff
DELETE FROM notifications
WHERE created_at > '2026-01-10 20:44:19.084192+00';

-- Step 6: Delete pulse records after cutoff
DELETE FROM drop_pulses
WHERE started_at > '2026-01-10 20:44:19.084192+00';

-- Step 7: Revert spot stats that were incorrectly updated
-- Joel simeon's Machine 1 (position 33 was incorrectly paid +900)
UPDATE spots
SET 
  total_cycles = GREATEST(total_cycles - 1, 0),
  total_earnings = GREATEST(total_earnings - 900, 0)
WHERE id = '41bf90ea-9764-481e-8407-f744692e446b';

-- Samuel Nnadozie's Machine 1 (position 34 was incorrectly paid +900)
UPDATE spots
SET 
  total_cycles = GREATEST(total_cycles - 1, 0),
  total_earnings = GREATEST(total_earnings - 900, 0)
WHERE id = '845a42ed-67a0-42de-ae87-503904f50074';

-- Chinedu's Machine 1 (position 35 was incorrectly paid +900)
UPDATE spots
SET 
  total_cycles = GREATEST(total_cycles - 1, 0),
  total_earnings = GREATEST(total_earnings - 900, 0)
WHERE id = '2a3b4a13-9bba-4e93-a91b-7051f6a92104';

-- Vivian's Machine 2 (position 36 was incorrectly paid +400)
UPDATE spots
SET 
  total_cycles = GREATEST(total_cycles - 1, 0),
  total_earnings = GREATEST(total_earnings - 400, 0)
WHERE id = 'acbb2113-e099-4dba-b6e1-815d58984093';

-- Step 8: Refresh ALL cached balances from remaining transactions
UPDATE cached_balances cb
SET 
  deposit_balance = COALESCE((
    SELECT SUM(amount) FROM transactions t 
    WHERE t.user_id = cb.user_id AND t.wallet_type = 'deposit' AND t.status = 'completed'
  ), 0),
  earnings_balance = COALESCE((
    SELECT SUM(amount) FROM transactions t 
    WHERE t.user_id = cb.user_id AND t.wallet_type = 'earnings' AND t.status = 'completed'
  ), 0),
  last_updated = NOW();