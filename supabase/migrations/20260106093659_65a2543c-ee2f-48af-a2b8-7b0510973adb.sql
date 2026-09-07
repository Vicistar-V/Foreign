-- =====================================================
-- FIX CACHED BALANCES FOR ALL USERS
-- Populate from transactions ledger + fix trigger
-- =====================================================

-- Step 1: Populate cached_balances for ALL users from transactions ledger
INSERT INTO cached_balances (user_id, earnings_balance, deposit_balance, last_updated)
SELECT 
  user_id,
  COALESCE(SUM(CASE WHEN wallet_type = 'earnings' AND status = 'completed' THEN amount ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN wallet_type = 'deposit' AND status = 'completed' THEN amount ELSE 0 END), 0),
  NOW()
FROM transactions
WHERE user_id != '00000000-0000-0000-0000-000000000000'
GROUP BY user_id
ON CONFLICT (user_id) DO UPDATE SET
  earnings_balance = EXCLUDED.earnings_balance,
  deposit_balance = EXCLUDED.deposit_balance,
  last_updated = NOW();

-- Step 2: Update trigger to fire on INSERT, UPDATE, DELETE
DROP TRIGGER IF EXISTS update_cached_balances_on_transaction ON transactions;

CREATE TRIGGER update_cached_balances_on_transaction
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION update_cached_balances();