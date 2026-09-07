-- ==========================================
-- SIMPLIFY SQL FUNCTIONS TO THIN SHELLS
-- The Edge Functions now do all the work!
-- ==========================================

-- Drop old complex functions that are now handled by Edge Functions
DROP FUNCTION IF EXISTS process_reentry_pulse() CASCADE;
DROP FUNCTION IF EXISTS process_single_reentry(uuid, integer, numeric, uuid, text, uuid) CASCADE;

-- Keep create_spot but simplify it - now just validates and returns data
-- The actual creation is done by the buy-spot Edge Function
CREATE OR REPLACE FUNCTION create_spot(
  _user_id UUID,
  _source_wallet wallet_type DEFAULT 'deposit'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config platform_config;
  v_balance NUMERIC;
  v_is_member BOOLEAN;
  v_is_banned BOOLEAN;
BEGIN
  -- Get platform config
  SELECT * INTO v_config FROM platform_config LIMIT 1;
  
  -- Check if user is member and not banned
  SELECT is_member, is_banned INTO v_is_member, v_is_banned
  FROM profiles WHERE id = _user_id;
  
  IF NOT v_is_member THEN
    RETURN json_build_object('success', false, 'error', 'Account not activated yet');
  END IF;
  
  IF v_is_banned THEN
    RETURN json_build_object('success', false, 'error', 'Account suspended');
  END IF;
  
  -- Check balance
  v_balance := check_balance(_user_id, _source_wallet);
  
  IF v_balance < v_config.drop_entry_fee THEN
    RETURN json_build_object(
      'success', false, 
      'error', format('Not enough money. You need ₦%s more.', v_config.drop_entry_fee - v_balance)
    );
  END IF;
  
  -- Return validation success - actual creation happens in Edge Function
  -- This is now just a validation helper
  RETURN json_build_object(
    'success', true,
    'validated', true,
    'balance', v_balance,
    'required', v_config.drop_entry_fee,
    'message', 'Validation passed - use buy-spot Edge Function for actual creation'
  );
END;
$$;

-- Simplified process_reentry_pulse - now just returns data for Edge Function to process
CREATE OR REPLACE FUNCTION process_reentry_pulse()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Just count unsettled re-entries - actual processing is done by Edge Function
  SELECT COUNT(*) INTO v_count
  FROM drops
  WHERE source_type = 're-entry'
    AND is_settled = false;
  
  RETURN json_build_object(
    'success', true,
    'pending_reentries', v_count,
    'message', 'Use process-drop-pulse Edge Function for actual processing'
  );
END;
$$;

-- Helper: Get next drop position (used by Edge Functions)
CREATE OR REPLACE FUNCTION get_next_drop_position()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_position INTEGER;
BEGIN
  SELECT COALESCE(MAX(position), 0) + 1 INTO v_max_position FROM drops;
  RETURN v_max_position;
END;
$$;

-- Add helpful comments
COMMENT ON FUNCTION create_spot IS 'Validation helper - actual spot creation is done by buy-spot Edge Function';
COMMENT ON FUNCTION process_reentry_pulse IS 'Status helper - actual processing is done by process-drop-pulse Edge Function';
COMMENT ON FUNCTION get_next_drop_position IS 'Returns the next available position number for new drops';