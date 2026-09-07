-- HOTFIX: Remove mistaken auto-cancel rows and correct over-refund

-- 1) Delete ONLY the auto-cancel rows we inserted (safe: clearly tagged)
DELETE FROM public.transactions
WHERE description = 'Auto-cancel: Failed withdrawal returned'
  AND COALESCE(metadata->>'cancel_reason','') = 'Failed withdrawal auto-correction';

-- 2) Fix Vivian Ikechi Wike specific ₦50 over-refund (refund was ₦1,250 instead of ₦1,200)
--    This brings her back to the correct ledger sum.
INSERT INTO public.transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
VALUES (
  'dae463a3-767c-46fe-bed7-a9d27f9a4548',
  'earnings',
  -50,
  'debt_reversal',
  'Balance correction: remove extra ₦50 refund',
  'completed',
  jsonb_build_object(
    'reason', 'support_fix_over_refund',
    'note', 'Refund was ₦1,250 but should have been ₦1,200 (fee already handled separately).',
    'corrected_at', now()
  )
);

-- 3) Make cache math grandma-simple: cached balances = SUM(amount) (no status filters)
CREATE OR REPLACE FUNCTION public.update_cached_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO cached_balances (user_id, earnings_balance, deposit_balance, last_updated)
  SELECT 
    COALESCE(NEW.user_id, OLD.user_id),
    COALESCE(SUM(CASE WHEN wallet_type = 'earnings' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN wallet_type = 'deposit' THEN amount ELSE 0 END), 0),
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

-- 4) Also make check_balance() = SUM(amount) (no filters)
CREATE OR REPLACE FUNCTION public.check_balance(_user_id uuid, _wallet_type wallet_type)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM public.transactions
  WHERE user_id = _user_id 
    AND wallet_type = _wallet_type;
$$;

-- 5) Force cache refresh (so UI updates immediately)
DELETE FROM public.cached_balances
WHERE user_id = 'dae463a3-767c-46fe-bed7-a9d27f9a4548';
