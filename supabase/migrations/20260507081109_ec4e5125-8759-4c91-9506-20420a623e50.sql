-- 1) Add pending_balance back to cached_balances (no day cutoff — lifetime sum)
ALTER TABLE public.cached_balances
  ADD COLUMN IF NOT EXISTS pending_balance numeric NOT NULL DEFAULT 0;

-- 2) Update trigger function so it also maintains pending_balance in the cache
CREATE OR REPLACE FUNCTION public.update_cached_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);

  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_user_id) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  INSERT INTO public.cached_balances (user_id, earnings_balance, deposit_balance, pending_balance, last_updated)
  SELECT
    v_user_id,
    COALESCE(SUM(CASE WHEN wallet_type = 'earnings' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN wallet_type = 'deposit'  THEN amount ELSE 0 END), 0),
    GREATEST(COALESCE(SUM(CASE WHEN wallet_type = 'pending'  THEN amount ELSE 0 END), 0), 0),
    now()
  FROM public.transactions
  WHERE user_id = v_user_id
  ON CONFLICT (user_id)
  DO UPDATE SET
    earnings_balance = EXCLUDED.earnings_balance,
    deposit_balance  = EXCLUDED.deposit_balance,
    pending_balance  = EXCLUDED.pending_balance,
    last_updated     = now();

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

-- 3) Backfill pending_balance for existing rows
UPDATE public.cached_balances cb
SET pending_balance = sub.pending_total,
    last_updated = now()
FROM (
  SELECT user_id,
         GREATEST(COALESCE(SUM(amount), 0), 0) AS pending_total
  FROM public.transactions
  WHERE wallet_type = 'pending'::wallet_type
  GROUP BY user_id
) sub
WHERE cb.user_id = sub.user_id;

-- 4) Insert any missing cached_balances rows for users who have pending but no cache row
INSERT INTO public.cached_balances (user_id, earnings_balance, deposit_balance, pending_balance, last_updated)
SELECT
  t.user_id,
  COALESCE(SUM(CASE WHEN t.wallet_type = 'earnings' THEN t.amount ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN t.wallet_type = 'deposit'  THEN t.amount ELSE 0 END), 0),
  GREATEST(COALESCE(SUM(CASE WHEN t.wallet_type = 'pending'  THEN t.amount ELSE 0 END), 0), 0),
  now()
FROM public.transactions t
JOIN public.profiles p ON p.id = t.user_id
LEFT JOIN public.cached_balances cb ON cb.user_id = t.user_id
WHERE cb.user_id IS NULL
GROUP BY t.user_id
ON CONFLICT (user_id) DO NOTHING;
