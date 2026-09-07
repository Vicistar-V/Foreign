-- Fix: Update get_drop_queue_status to count both 'paid' and 're-entered' for today's stats
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
  paid_today INT;
  paid_today_amount NUMERIC;
  next_position INT;
BEGIN
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

  -- Count drops paid today (FIXED: include both 'paid' and 're-entered')
  SELECT COUNT(*) INTO paid_today
  FROM drops
  WHERE status IN ('paid', 're-entered')
    AND paid_at >= CURRENT_DATE;

  -- Calculate total amount paid today (FIXED: include both 'paid' and 're-entered')
  SELECT COALESCE(COUNT(*) * 400, 0) INTO paid_today_amount
  FROM drops
  WHERE status IN ('paid', 're-entered')
    AND paid_at >= CURRENT_DATE;

  -- Get next position number
  SELECT COALESCE(MAX(position), 0) + 1 INTO next_position
  FROM drops;

  RETURN json_build_object(
    'total_in_queue', total_in_queue,
    'total_filling', total_filling,
    'total_waiting', total_waiting,
    'paid_today', paid_today,
    'paid_today_amount', paid_today_amount,
    'next_position', next_position
  );
END;
$$;