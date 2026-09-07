-- =====================================================
-- FIX: process_reentry_pulse to use is_settled boolean
-- Split into utility functions for maintainability
-- =====================================================

-- Utility 1: Get all unsettled re-entry drops
CREATE OR REPLACE FUNCTION public.get_unsettled_reentries()
RETURNS TABLE (
  drop_id UUID,
  spot_id UUID,
  user_id UUID,
  spot_name TEXT,
  user_name TEXT,
  drop_position INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    d.id as drop_id,
    d.spot_id,
    s.user_id,
    s.spot_name,
    p.full_name as user_name,
    d.position as drop_position
  FROM drops d
  JOIN spots s ON s.id = d.spot_id
  JOIN profiles p ON p.id = s.user_id
  WHERE d.is_settled = false
    AND d.source_type = 're-entry'
  ORDER BY d.position ASC;
$$;

-- Utility 2: Mark a drop as settled
CREATE OR REPLACE FUNCTION public.mark_drop_settled(_drop_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE drops 
  SET is_settled = true
  WHERE id = _drop_id;
$$;

-- Utility 3: Notify user about re-entry being processed
CREATE OR REPLACE FUNCTION public.notify_reentry_processed(
  _user_id UUID,
  _spot_name TEXT,
  _drop_position INTEGER
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  INSERT INTO notifications (user_id, title, message, notification_type, link, metadata)
  VALUES (
    _user_id,
    'Cycle Refreshed!',
    format('Your %s is back in The Line at Position #%s. Your stake is now working!', 
      _spot_name, _drop_position),
    'drop_joined',
    '/dashboard',
    json_build_object('spot_name', _spot_name, 'position', _drop_position)
  );
$$;

-- Utility 4: Process a single re-entry drop
CREATE OR REPLACE FUNCTION public.process_single_reentry(
  _drop_id UUID,
  _spot_id UUID,
  _user_id UUID,
  _spot_name TEXT,
  _drop_position INTEGER,
  _reentry_amount NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_distribution_result JSON;
BEGIN
  -- Distribute this re-entry's stake
  SELECT distribute_liquidity(_drop_id, _reentry_amount, 10) 
  INTO v_distribution_result;
  
  -- Mark this drop as settled
  PERFORM mark_drop_settled(_drop_id);
  
  -- Notify user
  PERFORM notify_reentry_processed(_user_id, _spot_name, _drop_position);
  
  RETURN v_distribution_result;
END;
$$;

-- Main function: Process all pending re-entries (rewritten)
CREATE OR REPLACE FUNCTION public.process_reentry_pulse()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pulse_id UUID;
  v_pulse_number INTEGER;
  v_re_entries_processed INTEGER := 0;
  v_payouts_triggered INTEGER := 0;
  v_total_distributed NUMERIC := 0;
  v_config RECORD;
  v_reentry RECORD;
  v_distribution_result JSON;
BEGIN
  -- Get platform config
  SELECT * INTO v_config FROM platform_config WHERE id = 1;
  
  -- Check if drop system is active
  IF NOT v_config.drop_system_active THEN
    RETURN json_build_object('success', false, 'error', 'Drop system is not active');
  END IF;
  
  -- Get next pulse number
  SELECT COALESCE(MAX(pulse_number), 0) + 1 INTO v_pulse_number FROM drop_pulses;
  
  -- Create pulse record
  INSERT INTO drop_pulses (pulse_number, status)
  VALUES (v_pulse_number, 'running')
  RETURNING id INTO v_pulse_id;
  
  -- Process all unsettled re-entry drops
  FOR v_reentry IN SELECT * FROM get_unsettled_reentries()
  LOOP
    v_re_entries_processed := v_re_entries_processed + 1;
    
    -- Process this single re-entry
    SELECT process_single_reentry(
      v_reentry.drop_id,
      v_reentry.spot_id,
      v_reentry.user_id,
      v_reentry.spot_name,
      v_reentry.drop_position,
      v_config.drop_reentry_amount
    ) INTO v_distribution_result;
    
    -- Track payouts from this distribution
    v_payouts_triggered := v_payouts_triggered + COALESCE((v_distribution_result->>'payouts_made')::INTEGER, 0);
    v_total_distributed := v_total_distributed + COALESCE((v_distribution_result->>'distributed')::NUMERIC, 0);
  END LOOP;
  
  -- Update pulse record
  UPDATE drop_pulses
  SET 
    completed_at = NOW(),
    new_drops_processed = 0,
    re_entries_processed = v_re_entries_processed,
    payouts_made = v_payouts_triggered,
    total_distributed = v_total_distributed,
    status = 'completed'
  WHERE id = v_pulse_id;
  
  RETURN json_build_object(
    'success', true,
    'pulse_number', v_pulse_number,
    're_entries_processed', v_re_entries_processed,
    'payouts_triggered', v_payouts_triggered,
    'total_distributed', v_total_distributed
  );
END;
$$;