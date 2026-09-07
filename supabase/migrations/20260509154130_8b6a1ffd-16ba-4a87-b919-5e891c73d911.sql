-- Remove the extra spot-total trigger. Spot totals are handled by the app flow, not by a database trigger.
DROP TRIGGER IF EXISTS update_spot_totals_when_drop_finishes ON public.drops;
DROP FUNCTION IF EXISTS public.update_spot_totals_when_drop_finishes();

-- Recompute existing spot totals from completed drops using one flat profit amount from the platform settings.
-- The app's rule is simple: every completed cycle earns the configured standard cycle profit.
WITH config AS (
  SELECT COALESCE(drop_profit_amount_subsequent, drop_profit_amount, 900) AS cycle_profit
  FROM public.platform_config
  WHERE id = 1
), spot_totals AS (
  SELECT
    s.id AS spot_id,
    COUNT(d.id)::integer AS cycles_done,
    (COUNT(d.id)::numeric * (SELECT cycle_profit FROM config)) AS earnings_done
  FROM public.spots s
  LEFT JOIN public.drops d
    ON d.spot_id = s.id
   AND d.status IN ('paid', 're-entered')
  GROUP BY s.id
)
UPDATE public.spots s
SET total_cycles = st.cycles_done,
    total_earnings = st.earnings_done
FROM spot_totals st
WHERE s.id = st.spot_id
  AND (
    s.total_cycles IS DISTINCT FROM st.cycles_done
    OR s.total_earnings IS DISTINCT FROM st.earnings_done
  );

-- Return spot details with the field names used by the app.
-- This fixes blank spot cards/drawers caused by id vs spot_id and id vs drop_id mismatches.
CREATE OR REPLACE FUNCTION public.get_user_drops_status(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'spots', COALESCE((
      SELECT json_agg(json_build_object(
        'spot_id', s.id,
        'id', s.id,
        'spot_name', COALESCE(s.spot_name, 'Spot'),
        'status', COALESCE(s.status, 'active'),
        'total_cycles', COALESCE(s.total_cycles, 0),
        'total_earnings', COALESCE(s.total_earnings, 0),
        'created_at', s.created_at,
        'current_drop', (
          SELECT json_build_object(
            'drop_id', d.id,
            'id', d.id,
            'position', d.position,
            'fill_amount', COALESCE(d.fill_amount, 0),
            'target_amount', COALESCE(d.target_amount, 0),
            'status', COALESCE(d.status, 'waiting'),
            'source_type', COALESCE(d.source_type, 'new'),
            'fill_percentage', CASE
              WHEN COALESCE(d.target_amount, 0) > 0
              THEN ROUND((COALESCE(d.fill_amount, 0) / d.target_amount) * 100, 1)
              ELSE 0
            END
          )
          FROM public.drops d
          WHERE d.spot_id = s.id
            AND d.status IN ('waiting', 'filling', 'completed')
          ORDER BY d.created_at DESC
          LIMIT 1
        )
      ) ORDER BY s.created_at ASC)
      FROM public.spots s
      WHERE s.user_id = _user_id
        AND s.status = 'active'
    ), '[]'::json),
    'active_spots_count', COALESCE((
      SELECT COUNT(*) FROM public.spots s
      WHERE s.user_id = _user_id AND s.status = 'active'
    ), 0),
    'total_earnings_all_time', COALESCE((
      SELECT SUM(total_earnings) FROM public.spots s
      WHERE s.user_id = _user_id AND s.status = 'active'
    ), 0)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_drops_status(_user_id uuid, _limit integer DEFAULT 6, _offset integer DEFAULT 0)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result json;
  v_total_spots integer;
  v_total_earnings numeric;
  v_total_cycles integer;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(total_earnings), 0), COALESCE(SUM(total_cycles), 0)
  INTO v_total_spots, v_total_earnings, v_total_cycles
  FROM public.spots
  WHERE user_id = _user_id
    AND status = 'active';

  SELECT json_build_object(
    'spots', COALESCE((
      SELECT json_agg(json_build_object(
        'spot_id', s.id,
        'id', s.id,
        'spot_name', COALESCE(s.spot_name, 'Spot'),
        'status', COALESCE(s.status, 'active'),
        'total_cycles', COALESCE(s.total_cycles, 0),
        'total_earnings', COALESCE(s.total_earnings, 0),
        'created_at', s.created_at,
        'current_drop', (
          SELECT json_build_object(
            'drop_id', d.id,
            'id', d.id,
            'position', d.position,
            'fill_amount', COALESCE(d.fill_amount, 0),
            'target_amount', COALESCE(d.target_amount, 0),
            'status', COALESCE(d.status, 'waiting'),
            'source_type', COALESCE(d.source_type, 'new'),
            'fill_percentage', CASE
              WHEN COALESCE(d.target_amount, 0) > 0
              THEN ROUND((COALESCE(d.fill_amount, 0) / d.target_amount) * 100, 1)
              ELSE 0
            END
          )
          FROM public.drops d
          WHERE d.spot_id = s.id
            AND d.status IN ('waiting', 'filling', 'completed')
          ORDER BY d.created_at DESC
          LIMIT 1
        )
      ) ORDER BY s.created_at ASC)
      FROM (
        SELECT *
        FROM public.spots
        WHERE user_id = _user_id
          AND status = 'active'
        ORDER BY created_at ASC
        LIMIT _limit OFFSET _offset
      ) s
    ), '[]'::json),
    'active_spots_count', v_total_spots,
    'total_earnings_all_time', v_total_earnings,
    'total_spots_count', v_total_spots,
    'total_earnings_all_spots', v_total_earnings,
    'total_cycles_all_spots', v_total_cycles,
    'has_more_spots', (v_total_spots > _limit + _offset)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;