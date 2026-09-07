-- Improve trigger: first cycle pays the smaller first-cycle profit, later cycles pay subsequent profit
CREATE OR REPLACE FUNCTION public.update_spot_totals_when_drop_finishes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first numeric := 0;
  v_subseq numeric := 0;
  v_current_cycles integer := 0;
  v_profit numeric := 0;
BEGIN
  IF NEW.status IN ('paid', 're-entered')
     AND COALESCE(OLD.status, '') NOT IN ('paid', 're-entered') THEN

    SELECT COALESCE(drop_profit_amount, 0), COALESCE(drop_profit_amount_subsequent, 0)
    INTO v_first, v_subseq
    FROM public.platform_config WHERE id = 1;

    SELECT COALESCE(total_cycles, 0) INTO v_current_cycles
    FROM public.spots WHERE id = NEW.spot_id FOR UPDATE;

    IF v_current_cycles = 0 THEN
      v_profit := v_first;
    ELSE
      v_profit := v_subseq;
    END IF;

    UPDATE public.spots
    SET total_cycles = v_current_cycles + 1,
        total_earnings = COALESCE(total_earnings, 0) + v_profit
    WHERE id = NEW.spot_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill: recompute totals from historical paid/re-entered drops, ordered by completion time
WITH drop_profits AS (
  SELECT
    d.spot_id,
    d.completed_at,
    ROW_NUMBER() OVER (PARTITION BY d.spot_id ORDER BY d.completed_at ASC, d.created_at ASC) AS cycle_index
  FROM public.drops d
  WHERE d.status IN ('paid', 're-entered')
),
totals AS (
  SELECT
    dp.spot_id,
    COUNT(*) AS cycles,
    SUM(
      CASE
        WHEN dp.cycle_index = 1 THEN COALESCE((SELECT drop_profit_amount FROM public.platform_config WHERE id=1), 0)
        ELSE COALESCE((SELECT drop_profit_amount_subsequent FROM public.platform_config WHERE id=1), 0)
      END
    ) AS earnings
  FROM drop_profits dp
  GROUP BY dp.spot_id
)
UPDATE public.spots s
SET total_cycles = t.cycles,
    total_earnings = t.earnings
FROM totals t
WHERE s.id = t.spot_id
  AND (s.total_cycles IS DISTINCT FROM t.cycles OR s.total_earnings IS DISTINCT FROM t.earnings);