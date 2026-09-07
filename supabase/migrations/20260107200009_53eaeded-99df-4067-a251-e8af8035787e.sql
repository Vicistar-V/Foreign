-- ============================================
-- COMPLETE FIX: Vivian's Account + Withdrawal System
-- ============================================

-- PART 1: Delete ALL of Vivian's withdrawal transactions (failed + pending)
DELETE FROM transactions 
WHERE user_id = 'dae463a3-767c-46fe-bed7-a9d27f9a4548'
  AND transaction_type = 'withdrawal';

-- PART 2: Delete all platform fees associated with Vivian's withdrawals
DELETE FROM transactions 
WHERE id IN (
  '8da9bedf-0a8d-44aa-ba09-a7061692d9f7',  -- ₦50 fee from WD-1767815411670
  '5a21f379-d5af-4c85-af0b-d75abc427fd2'   -- ₦50 fee from WD-1767814816463
);

-- PART 3: Invalidate Vivian's cached balance (trigger will recalculate)
DELETE FROM cached_balances 
WHERE user_id = 'dae463a3-767c-46fe-bed7-a9d27f9a4548';

-- PART 4: Fix check_balance to count ALL transactions (not just completed)
-- This ensures pending withdrawals are immediately deducted from balance
CREATE OR REPLACE FUNCTION public.check_balance(_user_id uuid, _wallet_type wallet_type)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(amount), 0)
  FROM public.transactions
  WHERE user_id = _user_id 
    AND wallet_type = _wallet_type
  -- NO status filter! Count ALL transactions including pending
  -- This ensures money is LOCKED immediately when withdrawal is initiated
$function$;