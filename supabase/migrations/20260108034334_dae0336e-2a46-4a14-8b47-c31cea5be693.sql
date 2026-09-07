-- Remove ₦400 from Chiemerie David okeke's deposit wallet
INSERT INTO transactions (
  user_id,
  amount,
  wallet_type,
  transaction_type,
  description,
  status
) VALUES (
  '8e46e5a3-e4a5-4e44-a0d6-7feaffa61c76',
  -400,
  'deposit',
  'admin_expense',
  'Admin correction - removed ₦400 from deposit wallet',
  'completed'
);

-- Update cached balance
UPDATE cached_balances 
SET deposit_balance = deposit_balance - 400,
    last_updated = NOW()
WHERE user_id = '8e46e5a3-e4a5-4e44-a0d6-7feaffa61c76';