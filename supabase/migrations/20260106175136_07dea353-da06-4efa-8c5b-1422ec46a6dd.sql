-- Optimize get_user_drops_status to support pagination and return summary stats
CREATE OR REPLACE FUNCTION get_user_drops_status(
  _user_id UUID,
  _limit INTEGER DEFAULT 6,
  _offset INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_genesis_spot RECORD;
  v_total_spots INTEGER;
  v_total_earnings NUMERIC;
  v_total_cycles INTEGER;
BEGIN
  -- Get genesis spot info for this user
  SELECT is_genesis_spot, genesis_yields_remaining
  INTO v_genesis_spot
  FROM spots
  WHERE user_id = _user_id AND is_genesis_spot = true
  LIMIT 1;

  -- Get summary stats for ALL active spots (fast aggregate queries)
  SELECT 
    COUNT(*),
    COALESCE(SUM(total_earnings), 0),
    COALESCE(SUM(total_cycles), 0)
  INTO v_total_spots, v_total_earnings, v_total_cycles
  FROM spots
  WHERE user_id = _user_id AND status = 'active';

  -- Build result with LIMITED spots but FULL stats
  SELECT json_build_object(
    'spots', COALESCE((
      SELECT json_agg(json_build_object(
        'id', s.id,
        'spot_name', s.spot_name,
        'status', s.status,
        'total_cycles', s.total_cycles,
        'total_earnings', s.total_earnings,
        'is_genesis_spot', s.is_genesis_spot,
        'genesis_yields_remaining', s.genesis_yields_remaining,
        'created_at', s.created_at,
        'current_drop', (
          SELECT json_build_object(
            'id', d.id,
            'position', d.position,
            'fill_amount', d.fill_amount,
            'target_amount', d.target_amount,
            'status', d.status,
            'fill_percentage', ROUND((d.fill_amount / d.target_amount) * 100, 1)
          )
          FROM drops d
          WHERE d.spot_id = s.id AND d.status IN ('waiting', 'filling')
          ORDER BY d.created_at DESC
          LIMIT 1
        )
      ) ORDER BY s.created_at ASC)
      FROM (
        SELECT * FROM spots
        WHERE user_id = _user_id AND status = 'active'
        ORDER BY created_at ASC
        LIMIT _limit OFFSET _offset
      ) s
    ), '[]'::json),
    'total_spots_count', v_total_spots,
    'total_earnings_all_spots', v_total_earnings,
    'total_cycles_all_spots', v_total_cycles,
    'has_more_spots', (v_total_spots > _limit + _offset),
    'genesis_yields_remaining', COALESCE(v_genesis_spot.genesis_yields_remaining, 0),
    'has_genesis_spot', COALESCE(v_genesis_spot.is_genesis_spot, false)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;