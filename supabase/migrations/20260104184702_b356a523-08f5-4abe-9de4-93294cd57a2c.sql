-- Recalculate balances for Victor Ogazie accounts and SYSTEM_TREASURY
UPDATE user_balances SET
  earnings_balance = COALESCE((SELECT SUM(amount) FROM transactions WHERE user_id = user_balances.user_id AND wallet_type = 'earnings'), 0),
  deposit_balance = COALESCE((SELECT SUM(amount) FROM transactions WHERE user_id = user_balances.user_id AND wallet_type = 'deposit'), 0),
  credits_balance = COALESCE((SELECT SUM(amount) FROM transactions WHERE user_id = user_balances.user_id AND wallet_type = 'credits'), 0),
  last_updated = now()
WHERE user_id IN (
  '5d7a5ea2-034c-4665-86b6-816d81dc0330',
  '15980d55-ca66-44f9-b8e2-6fb26fa74179',
  '00000000-0000-0000-0000-000000000000'
);