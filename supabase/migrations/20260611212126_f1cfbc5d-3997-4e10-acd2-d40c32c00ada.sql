
CREATE OR REPLACE FUNCTION public.get_drop_queue_status()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_in_queue INT;
  total_filling INT;
  total_waiting INT;
  paid_count INT;
  paid_amount NUMERIC;
  next_position INT;
  last_payout_at TIMESTAMPTZ;
  profit_per_cycle NUMERIC;
BEGIN
  SELECT COALESCE(drop_profit_amount_subsequent, drop_profit_amount, 900) INTO profit_per_cycle
  FROM platform_config WHERE id = 1;

  SELECT COUNT(*) INTO total_in_queue
  FROM drops WHERE status IN ('waiting', 'filling');

  SELECT COUNT(*) INTO total_filling
  FROM drops WHERE status = 'filling';

  SELECT COUNT(*) INTO total_waiting
  FROM drops WHERE status = 'waiting';

  -- ALL-TIME paid count (no date filter)
  SELECT COUNT(*) INTO paid_count
  FROM drops
  WHERE status IN ('paid', 're-entered');

  paid_amount := paid_count * profit_per_cycle;

  SELECT MAX(paid_at) INTO last_payout_at
  FROM drops WHERE status IN ('paid', 're-entered');

  SELECT COALESCE(MAX(position), 0) + 1 INTO next_position FROM drops;

  RETURN json_build_object(
    'total_in_queue', total_in_queue,
    'total_filling', total_filling,
    'total_waiting', total_waiting,
    'paid_today_count', paid_count,
    'paid_today_amount', paid_amount,
    'next_position', next_position,
    'last_payout_at', last_payout_at
  );
END;
$function$;
