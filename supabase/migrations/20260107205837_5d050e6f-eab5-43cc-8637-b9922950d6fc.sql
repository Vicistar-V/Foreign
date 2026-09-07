-- Fix: Update cached_balances to include pending withdrawals
-- This ensures withdrawals are immediately deducted from displayed balance

CREATE OR REPLACE FUNCTION public.update_cached_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Calculate and cache balances for the user
  -- Now includes PENDING WITHDRAWALS so they are immediately deducted from displayed balance
  INSERT INTO cached_balances (user_id, earnings_balance, deposit_balance, last_updated)
  SELECT 
    COALESCE(NEW.user_id, OLD.user_id),
    -- For earnings: Count completed transactions AND pending withdrawals
    COALESCE(SUM(CASE 
      WHEN wallet_type = 'earnings' AND (
        status = 'completed' 
        OR (status = 'pending' AND transaction_type = 'withdrawal')
      ) THEN amount 
      ELSE 0 
    END), 0),
    -- For deposit: Count completed transactions AND pending withdrawals
    COALESCE(SUM(CASE 
      WHEN wallet_type = 'deposit' AND (
        status = 'completed' 
        OR (status = 'pending' AND transaction_type = 'withdrawal')
      ) THEN amount 
      ELSE 0 
    END), 0),
    now()
  FROM transactions
  WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
  ON CONFLICT (user_id) 
  DO UPDATE SET
    earnings_balance = EXCLUDED.earnings_balance,
    deposit_balance = EXCLUDED.deposit_balance,
    last_updated = now();
  
  RETURN NEW;
END;
$$;

-- Force recalculate caches for ALL users with pending withdrawals
-- This will trigger recalculation on next balance fetch
DELETE FROM cached_balances 
WHERE user_id IN (
  SELECT DISTINCT user_id 
  FROM transactions 
  WHERE transaction_type = 'withdrawal' 
    AND status = 'pending'
);