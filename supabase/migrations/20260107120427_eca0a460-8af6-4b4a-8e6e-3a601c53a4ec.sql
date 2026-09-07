-- Update get_miner_details function to include avatar_url
CREATE OR REPLACE FUNCTION public.get_miner_details(_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_code TEXT;
  v_result JSON;
BEGIN
  -- Get user's referral code
  SELECT referral_code INTO v_referral_code
  FROM profiles
  WHERE id = _user_id;
  
  IF v_referral_code IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;
  
  -- Get detailed miner information
  SELECT json_build_object(
    'success', true,
    'miners', COALESCE((
      SELECT json_agg(miner_data ORDER BY miner_data->>'last_activity' DESC NULLS LAST)
      FROM (
        SELECT json_build_object(
          'id', p.id,
          'name', p.full_name,
          'avatar_url', p.avatar_url,
          'is_member', p.is_member,
          'has_spot', EXISTS(SELECT 1 FROM spots s WHERE s.user_id = p.id AND s.status = 'active'),
          'spot_count', COALESCE(
            (SELECT COUNT(*) FROM spots s WHERE s.user_id = p.id AND s.status = 'active'),
            0
          ),
          'joined_at', p.created_at,
          'last_activity', COALESCE(
            (SELECT MAX(t.created_at) FROM transactions t WHERE t.user_id = p.id),
            p.created_at
          ),
          'machine_count', COALESCE(
            (SELECT COUNT(*) FROM spots s WHERE s.user_id = p.id AND s.status = 'active'),
            0
          ),
          'total_yields', COALESCE(
            (SELECT SUM(s.total_cycles) FROM spots s WHERE s.user_id = p.id),
            0
          ),
          'referrer_earnings', COALESCE(
            (
              SELECT SUM(t.amount)::NUMERIC
              FROM transactions t
              WHERE t.user_id = _user_id
              AND t.status = 'completed'
              AND t.transaction_type = 'drop_referral_cycle' 
              AND t.metadata->>'referee_id' = p.id::TEXT
            ),
            0
          )
        ) AS miner_data
        FROM profiles p
        WHERE LOWER(p.referred_by_code) = LOWER(v_referral_code)
      ) AS miners
    ), '[]'::json),
    'summary', json_build_object(
      'total_miners', (
        SELECT COUNT(*) FROM profiles WHERE LOWER(referred_by_code) = LOWER(v_referral_code)
      ),
      'active_miners', (
        SELECT COUNT(DISTINCT p.id) 
        FROM profiles p
        WHERE LOWER(p.referred_by_code) = LOWER(v_referral_code)
        AND EXISTS(SELECT 1 FROM spots s WHERE s.user_id = p.id AND s.status = 'active')
      ),
      'pending_miners', (
        SELECT COUNT(*) 
        FROM profiles p
        WHERE LOWER(p.referred_by_code) = LOWER(v_referral_code)
        AND NOT EXISTS(SELECT 1 FROM spots s WHERE s.user_id = p.id AND s.status = 'active')
      ),
      'total_machines_in_network', COALESCE(
        (
          SELECT SUM(spot_count)::INTEGER
          FROM (
            SELECT (SELECT COUNT(*) FROM spots s WHERE s.user_id = p.id AND s.status = 'active') AS spot_count
            FROM profiles p
            WHERE LOWER(p.referred_by_code) = LOWER(v_referral_code)
          ) AS network_spots
        ),
        0
      ),
      'total_network_yields', COALESCE(
        (
          SELECT SUM(total_cycles)::INTEGER
          FROM spots s
          JOIN profiles p ON s.user_id = p.id
          WHERE LOWER(p.referred_by_code) = LOWER(v_referral_code)
        ),
        0
      ),
      'total_royalty_earnings', COALESCE(
        (
          SELECT SUM(t.amount)::NUMERIC
          FROM transactions t
          WHERE t.user_id = _user_id
          AND t.transaction_type = 'drop_referral_cycle'
          AND t.wallet_type = 'earnings'
          AND t.status = 'completed'
        ),
        0
      ),
      'per_yield_potential', (
        SELECT COUNT(*) * 20
        FROM profiles p
        WHERE LOWER(p.referred_by_code) = LOWER(v_referral_code)
        AND EXISTS(SELECT 1 FROM spots s WHERE s.user_id = p.id AND s.status = 'active')
      )
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;