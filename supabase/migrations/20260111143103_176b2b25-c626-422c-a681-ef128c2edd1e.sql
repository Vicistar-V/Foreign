-- Zero out Abubakar Ishaq's earnings balance
-- Delete the earnings transactions or add a correction

-- Get Abubakar's user_id and add correction transaction
INSERT INTO transactions (user_id, transaction_type, amount, wallet_type, description, status)
SELECT 
  p.id,
  'debt_reversal',
  -300,
  'earnings',
  'Correction: Zero out earnings for rollback',
  'completed'
FROM profiles p
WHERE p.full_name = 'Abubakar Ishaq';

-- Refresh their cached balance
UPDATE cached_balances cb
SET 
  earnings_balance = COALESCE((
    SELECT SUM(amount) FROM transactions t 
    WHERE t.user_id = cb.user_id AND t.wallet_type = 'earnings' AND t.status = 'completed'
  ), 0),
  last_updated = NOW()
WHERE cb.user_id = (SELECT id FROM profiles WHERE full_name = 'Abubakar Ishaq');