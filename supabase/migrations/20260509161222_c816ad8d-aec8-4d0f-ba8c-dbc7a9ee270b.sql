
-- Backfill spots.total_cycles and spots.total_earnings from drops history.
-- Cycles = drops that ever completed (status in completed/paid).
-- Earnings = paid cycles * current drop_profit_amount from platform_config.
WITH cfg AS (
  SELECT drop_profit_amount FROM public.platform_config WHERE id = 1
),
agg AS (
  SELECT
    spot_id,
    COUNT(*) FILTER (WHERE status IN ('completed','paid')) AS cycles,
    COUNT(*) FILTER (WHERE status = 'paid') AS paid_cycles
  FROM public.drops
  GROUP BY spot_id
)
UPDATE public.spots s
SET
  total_cycles  = agg.cycles,
  total_earnings = agg.paid_cycles * (SELECT drop_profit_amount FROM cfg)
FROM agg
WHERE s.id = agg.spot_id;
