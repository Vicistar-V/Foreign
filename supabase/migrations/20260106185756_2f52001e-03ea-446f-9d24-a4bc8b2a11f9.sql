-- Fix the get_drop_queue_status function to include paid_today_amount
CREATE OR REPLACE FUNCTION public.get_drop_queue_status()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_in_queue INTEGER;
  paid_today INTEGER;
  paid_today_amount DECIMAL(12,2);
  last_payout TIMESTAMPTZ;
  next_position INTEGER;
  result JSON;
  filling_drops JSON;
  recent_payouts JSON;
BEGIN
  -- Count drops waiting or filling
  SELECT COUNT(*) INTO total_in_queue
  FROM drops
  WHERE status IN ('waiting', 'filling');

  -- Count drops paid today
  SELECT COUNT(*) INTO paid_today
  FROM drops
  WHERE status = 're-entered'
    AND paid_at >= CURRENT_DATE;

  -- Calculate total amount paid today (profit per payout)
  SELECT COALESCE(COUNT(*) * 400, 0) INTO paid_today_amount
  FROM drops
  WHERE status = 're-entered'
    AND paid_at >= CURRENT_DATE;

  -- Get last payout time
  SELECT MAX(paid_at) INTO last_payout
  FROM drops
  WHERE status = 're-entered';

  -- Get next position to be paid (lowest position that is filling)
  SELECT MIN(position) INTO next_position
  FROM drops
  WHERE status IN ('waiting', 'filling');

  -- Get currently filling drops (top 5)
  SELECT COALESCE(json_agg(d ORDER BY d.position), '[]'::json) INTO filling_drops
  FROM (
    SELECT 
      dr.id,
      dr.position,
      dr.fill_amount,
      dr.target_amount,
      dr.created_at,
      p.full_name,
      p.avatar_url
    FROM drops dr
    JOIN spots s ON dr.spot_id = s.id
    JOIN profiles p ON s.user_id = p.id
    WHERE dr.status IN ('waiting', 'filling')
    ORDER BY dr.position
    LIMIT 5
  ) d;

  -- Get recent payouts (last 10)
  SELECT COALESCE(json_agg(d ORDER BY d.paid_at DESC), '[]'::json) INTO recent_payouts
  FROM (
    SELECT 
      dr.id,
      dr.position,
      dr.paid_at,
      dr.target_amount,
      p.full_name,
      p.avatar_url
    FROM drops dr
    JOIN spots s ON dr.spot_id = s.id
    JOIN profiles p ON s.user_id = p.id
    WHERE dr.status = 're-entered'
    ORDER BY dr.paid_at DESC
    LIMIT 10
  ) d;

  result := json_build_object(
    'total_in_queue', total_in_queue,
    'paid_today_count', paid_today,
    'paid_today_amount', paid_today_amount,
    'last_payout_at', last_payout,
    'next_position', next_position,
    'filling_drops', filling_drops,
    'recent_payouts', recent_payouts
  );

  RETURN result;
END;
$$;