-- FULL ROLLBACK: Undo all distributions after position 32

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

-- Step 7: Refresh ALL cached balances from remaining transactions
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