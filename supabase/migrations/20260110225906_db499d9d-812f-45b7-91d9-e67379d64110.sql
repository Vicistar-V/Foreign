-- Fix: Update get_drop_queue_status with correct field names, Nigeria timezone, and dynamic profit amount
CREATE OR REPLACE FUNCTION public.get_drop_queue_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_in_queue INT;
  total_filling INT;
  total_waiting INT;
  paid_today_count INT;
  paid_today_amount NUMERIC;
  next_position INT;
  last_payout_at TIMESTAMPTZ;
  profit_per_cycle NUMERIC;
  nigeria_today_start TIMESTAMPTZ;
BEGIN
  -- Calculate Nigeria midnight in UTC (Nigeria is UTC+1)
  nigeria_today_start := (NOW() AT TIME ZONE 'Africa/Lagos')::date AT TIME ZONE 'Africa/Lagos';

  -- Get profit amount from platform config
  SELECT COALESCE(drop_profit_amount_subsequent, drop_profit_amount, 900) INTO profit_per_cycle
  FROM platform_config WHERE id = 1;

  -- Count total drops in queue (waiting + filling)
  SELECT COUNT(*) INTO total_in_queue
  FROM drops
  WHERE status IN ('waiting', 'filling');

  -- Count filling drops
  SELECT COUNT(*) INTO total_filling
  FROM drops
  WHERE status = 'filling';

  -- Count waiting drops
  SELECT COUNT(*) INTO total_waiting
  FROM drops
  WHERE status = 'waiting';

  -- Count drops paid today using Nigeria timezone
  SELECT COUNT(*) INTO paid_today_count
  FROM drops
  WHERE status IN ('paid', 're-entered')
    AND paid_at >= nigeria_today_start;

  -- Calculate total amount paid today using actual profit from config
  paid_today_amount := paid_today_count * profit_per_cycle;

  -- Get last payout time
  SELECT MAX(paid_at) INTO last_payout_at
  FROM drops
  WHERE status IN ('paid', 're-entered');

  -- Get next position number
  SELECT COALESCE(MAX(position), 0) + 1 INTO next_position
  FROM drops;

  RETURN json_build_object(
    'total_in_queue', total_in_queue,
    'total_filling', total_filling,
    'total_waiting', total_waiting,
    'paid_today_count', paid_today_count,
    'paid_today_amount', paid_today_amount,
    'next_position', next_position,
    'last_payout_at', last_payout_at
  );
END;
$$;