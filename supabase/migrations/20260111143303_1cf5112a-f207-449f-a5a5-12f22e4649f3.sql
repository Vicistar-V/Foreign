-- 1. Give Abubakar back his ₦300 earnings
INSERT INTO transactions (user_id, transaction_type, amount, wallet_type, description, status)
SELECT 
  p.id,
  'subsidy',
  300,
  'earnings',
  'Correction: Restore earnings balance',
  'completed'
FROM profiles p
WHERE p.full_name = 'Abubakar Ishaq';

-- 2. Reset ALL waiting/filling drops to 0 progress
UPDATE drops
SET 
  fill_amount = 0,
  status = 'waiting'
WHERE status IN ('waiting', 'filling');

-- 3. Refresh Abubakar's cached balance
UPDATE cached_balances cb
SET 
  earnings_balance = COALESCE((
    SELECT SUM(amount) FROM transactions t 
    WHERE t.user_id = cb.user_id AND t.wallet_type = 'earnings' AND t.status = 'completed'
  ), 0),
  last_updated = NOW()
WHERE cb.user_id = (SELECT id FROM profiles WHERE full_name = 'Abubakar Ishaq');