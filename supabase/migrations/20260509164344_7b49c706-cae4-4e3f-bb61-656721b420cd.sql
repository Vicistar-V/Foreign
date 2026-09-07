DROP FUNCTION IF EXISTS public.update_spot_stats(uuid, numeric);

CREATE OR REPLACE FUNCTION public.update_spot_stats(_spot_id uuid, _profit_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.spots
  SET total_cycles = total_cycles + 1,
      total_earnings = total_earnings + COALESCE(_profit_amount, 0)
  WHERE id = _spot_id;

  RETURN jsonb_build_object(
    'updated', true,
    'spot_id', _spot_id,
    'profit', COALESCE(_profit_amount, 0)
  );
END;
$$;

WITH cycle_counts AS (
  SELECT spot_id, COUNT(*)::int AS cycles
  FROM public.drops
  WHERE status = 'completed'
  GROUP BY spot_id
),
earnings_sums AS (
  SELECT spot_id, COALESCE(SUM(amount), 0) AS earnings
  FROM public.drop_fill_audit_log
  WHERE payout_made = true AND spot_id IS NOT NULL
  GROUP BY spot_id
)
UPDATE public.spots s
SET total_cycles   = COALESCE(c.cycles, 0),
    total_earnings = COALESCE(e.earnings, 0)
FROM (SELECT id FROM public.spots) ids
LEFT JOIN cycle_counts c   ON c.spot_id = ids.id
LEFT JOIN earnings_sums e  ON e.spot_id = ids.id
WHERE s.id = ids.id;

DELETE FROM public.transactions
WHERE user_id = '033dacaf-6c77-4bfd-91c4-108a6120bc89'
  AND amount < 0;
