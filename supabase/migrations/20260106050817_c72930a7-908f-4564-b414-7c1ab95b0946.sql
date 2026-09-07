-- Update get_drop_queue_status to use 24-hour rolling window instead of CURRENT_DATE
CREATE OR REPLACE FUNCTION get_drop_queue_status()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  total_in_queue INTEGER;
  paid_today INTEGER;
  last_payout TIMESTAMPTZ;
  next_position INTEGER;
  filling_drops JSON;
  recent_payouts JSON;
BEGIN
  -- Count total active drops in queue
  SELECT COUNT(*) INTO total_in_queue
  FROM drops
  WHERE status IN ('waiting', 'filling');
  
  -- Count paid in last 24 hours (rolling window, not UTC midnight reset)
  SELECT COUNT(*) INTO paid_today
  FROM drops
  WHERE status = 'paid'
  AND paid_at >= NOW() - INTERVAL '24 hours';
  
  -- Get last payout time
  SELECT MAX(paid_at) INTO last_payout
  FROM drops
  WHERE status = 'paid';
  
  -- Get next position number
  SELECT COALESCE(MAX(position), 0) + 1 INTO next_position
  FROM drops;
  
  -- Get currently filling drops (top 5) with user info
  SELECT COALESCE(json_agg(filling_data), '[]'::json) INTO filling_drops
  FROM (
    SELECT 
      d.id,
      d.position,
      d.fill_amount,
      d.target_amount,
      d.created_at,
      p.full_name,
      p.avatar_url
    FROM drops d
    JOIN spots s ON d.spot_id = s.id
    JOIN profiles p ON s.user_id = p.id
    WHERE d.status IN ('waiting', 'filling')
    AND d.fill_amount > 0
    ORDER BY d.position ASC
    LIMIT 5
  ) filling_data;
  
  -- Get recent payouts (last 10) with user info
  SELECT COALESCE(json_agg(payout_data), '[]'::json) INTO recent_payouts
  FROM (
    SELECT 
      d.id,
      d.position,
      d.paid_at,
      d.target_amount,
      p.full_name,
      p.avatar_url
    FROM drops d
    JOIN spots s ON d.spot_id = s.id
    JOIN profiles p ON s.user_id = p.id
    WHERE d.status = 'paid'
    ORDER BY d.paid_at DESC
    LIMIT 10
  ) payout_data;
  
  -- Build result
  result := json_build_object(
    'total_in_queue', total_in_queue,
    'paid_today_count', paid_today,
    'last_payout_at', last_payout,
    'next_position', next_position,
    'filling_drops', filling_drops,
    'recent_payouts', recent_payouts
  );
  
  RETURN result;
END;
$$;