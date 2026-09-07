-- Create function to get detailed miner information for the Mining Network
CREATE OR REPLACE FUNCTION get_miner_details(_user_id UUID)
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
          'is_member', p.is_member,
          'joined_at', p.created_at,
          'last_activity', COALESCE(
            (SELECT MAX(t.created_at) FROM transactions t WHERE t.user_id = p.id),
            p.created_at
          ),
          'machine_count', COALESCE(
            (SELECT COUNT(*) FROM spots s WHERE s.user_id = p.id AND s.status = 'active'),
            0
          ),
          'total_cycles', COALESCE(
            (SELECT SUM(s.total_cycles) FROM spots s WHERE s.user_id = p.id),
            0
          ),
          'referrer_earnings', COALESCE(
            (
              SELECT SUM(t.amount)::NUMERIC
              FROM transactions t
              WHERE t.user_id = _user_id
              AND t.status = 'completed'
              AND (
                -- Activation bonus
                (t.transaction_type = 'membership_bonus' AND t.metadata->>'original_user_id' = p.id::TEXT)
                OR
                -- Cycle royalties
                (t.transaction_type = 'drop_referral_cycle' AND t.metadata->>'referee_id' = p.id::TEXT)
              )
            ),
            0
          )
        ) AS miner_data
        FROM profiles p
        WHERE p.referred_by_code = v_referral_code
      ) AS miners
    ), '[]'::json),
    'summary', json_build_object(
      'total_miners', (
        SELECT COUNT(*) FROM profiles WHERE referred_by_code = v_referral_code
      ),
      'active_miners', (
        SELECT COUNT(*) FROM profiles WHERE referred_by_code = v_referral_code AND is_member = true
      ),
      'pending_miners', (
        SELECT COUNT(*) FROM profiles WHERE referred_by_code = v_referral_code AND is_member = false
      ),
      'total_machines_in_network', COALESCE(
        (
          SELECT SUM(spot_count)::INTEGER
          FROM (
            SELECT (SELECT COUNT(*) FROM spots s WHERE s.user_id = p.id AND s.status = 'active') AS spot_count
            FROM profiles p
            WHERE p.referred_by_code = v_referral_code
          ) AS network_spots
        ),
        0
      ),
      'total_network_cycles', COALESCE(
        (
          SELECT SUM(total_cycles)::INTEGER
          FROM spots s
          JOIN profiles p ON s.user_id = p.id
          WHERE p.referred_by_code = v_referral_code
        ),
        0
      ),
      'total_activation_earnings', COALESCE(
        (
          SELECT SUM(t.amount)::NUMERIC
          FROM transactions t
          JOIN profiles p ON t.metadata->>'original_user_id' = p.id::TEXT
          WHERE t.user_id = _user_id
          AND t.transaction_type = 'membership_bonus'
          AND t.wallet_type = 'earnings'
          AND t.status = 'completed'
          AND p.referred_by_code = v_referral_code
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
      'per_cycle_potential', (
        SELECT COUNT(*) * 20  -- ₦20 per active miner per cycle
        FROM profiles
        WHERE referred_by_code = v_referral_code
        AND is_member = true
      )
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;