-- =====================================================
-- MIGRATION: Switch to Edge Function for Distribution
-- All business logic now lives in the Edge Function
-- RPCs just write pre-calculated values
-- =====================================================

-- Enable pg_net extension for HTTP calls from SQL
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- =====================================================
-- 1. Helper function to call the Edge Function
-- Uses async HTTP POST via pg_net
-- =====================================================
CREATE OR REPLACE FUNCTION public.call_distribute_liquidity_edge(
  _origin_drop_id UUID,
  _amount NUMERIC,
  _max_depth INTEGER DEFAULT 100
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_request_id BIGINT;
  v_edge_function_url TEXT;
  v_service_role_key TEXT;
BEGIN
  -- Build the Edge Function URL
  v_edge_function_url := 'https://sbprvewcfrtazdlcfvxt.supabase.co/functions/v1/distribute-liquidity';
  
  -- Get service role key from Supabase Vault (set via dashboard)
  -- Falls back to empty string if not set
  v_service_role_key := COALESCE(current_setting('supabase.service_role_key', true), '');
  
  -- Make async HTTP POST to the Edge Function
  SELECT extensions.http_post(
    url := v_edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object(
      'origin_drop_id', _origin_drop_id,
      'amount', _amount,
      'max_depth', _max_depth
    )::TEXT
  ) INTO v_request_id;
  
  -- Return immediately (async call - doesn't wait for response)
  RETURN json_build_object(
    'success', true,
    'async', true,
    'request_id', v_request_id,
    'message', 'Distribution triggered via Edge Function'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- If pg_net fails, log but don't block the transaction
    RAISE WARNING 'Edge function call failed: %', SQLERRM;
    RETURN json_build_object(
      'success', false,
      'async', false,
      'error', SQLERRM
    );
END;
$$;

-- =====================================================
-- 2. Update create_spot to use Edge Function
-- Same logic, but distribution happens via Edge Function
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_spot(_user_id uuid, _source_wallet wallet_type DEFAULT 'deposit'::wallet_type)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_config RECORD;
  v_balance NUMERIC;
  v_spot_id UUID;
  v_drop_id UUID;
  v_position INTEGER;
  v_spot_count INTEGER;
  v_spot_name TEXT;
  v_distribution_result JSON;
BEGIN
  -- Get platform config
  SELECT * INTO v_config FROM platform_config WHERE id = 1;
  
  -- Check if drop system is active
  IF NOT v_config.drop_system_active THEN
    RETURN json_build_object('success', false, 'error', 'The Viketa Line is currently paused');
  END IF;
  
  -- Check balance in source wallet
  SELECT check_balance(_user_id, _source_wallet) INTO v_balance;
  
  IF v_balance < v_config.drop_entry_fee THEN
    RETURN json_build_object(
      'success', false, 
      'error', format('Not enough money in your %s wallet. You need ₦%s but have ₦%s', 
        _source_wallet, v_config.drop_entry_fee, v_balance)
    );
  END IF;
  
  -- Count existing spots for this user
  SELECT COUNT(*) INTO v_spot_count FROM spots WHERE user_id = _user_id AND status = 'active';
  
  -- Simple naming: Machine 1, Machine 2, etc.
  v_spot_name := format('Machine %s', v_spot_count + 1);
  
  -- Deduct entry fee from source wallet
  INSERT INTO transactions (
    user_id,
    amount,
    transaction_type,
    wallet_type,
    description,
    status
  ) VALUES (
    _user_id,
    -v_config.drop_entry_fee,
    'drop_entry',
    _source_wallet,
    format('Bought %s - joined The Viketa Line', v_spot_name),
    'completed'
  );
  
  -- Create the spot (NO genesis flags)
  INSERT INTO spots (user_id, spot_name, status)
  VALUES (_user_id, v_spot_name, 'active')
  RETURNING id INTO v_spot_id;
  
  -- Get next position in line
  SELECT get_next_drop_position() INTO v_position;
  
  -- Create the drop entry (marked as settled since Edge Function processes immediately)
  INSERT INTO drops (spot_id, position, status, source_type, is_settled)
  VALUES (v_spot_id, v_position, 'waiting', 'new', true)
  RETURNING id INTO v_drop_id;
  
  -- =====================================================
  -- CHANGED: Call Edge Function instead of SQL distribute_liquidity
  -- This is ASYNC - user gets instant response
  -- Edge Function handles all business logic + writes atomically
  -- =====================================================
  SELECT call_distribute_liquidity_edge(
    v_drop_id,                 -- Origin drop (don't fill your own bucket)
    v_config.drop_entry_fee,   -- Amount to distribute (₦1,000)
    100                        -- Max cascade depth
  ) INTO v_distribution_result;
  
  -- Create notification for user
  PERFORM create_notification(
    _user_id := _user_id,
    _type := 'spot_created',
    _title := format('%s is now active!', v_spot_name),
    _message := format('You are now Position #%s in The Viketa Line. When 2 people join after you, you earn!', v_position)
  );
  
  RETURN json_build_object(
    'success', true,
    'spot_id', v_spot_id,
    'drop_id', v_drop_id,
    'position', v_position,
    'spot_name', v_spot_name,
    'distribution', v_distribution_result
  );
END;
$$;

-- =====================================================
-- 3. Update process_single_reentry to use Edge Function
-- Same change - distribution via Edge Function
-- =====================================================
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
  -- =====================================================
  -- CHANGED: Call Edge Function instead of SQL distribute_liquidity
  -- Edge Function handles all business logic + writes atomically
  -- =====================================================
  SELECT call_distribute_liquidity_edge(_drop_id, _reentry_amount, 100) 
  INTO v_distribution_result;
  
  -- Mark this drop as settled
  PERFORM mark_drop_settled(_drop_id);
  
  -- Notify user
  PERFORM notify_reentry_processed(_user_id, _spot_name, _drop_position);
  
  RETURN v_distribution_result;
END;
$$;

-- =====================================================
-- 4. Keep old distribute_liquidity as legacy fallback
-- Rename so we have rollback option if needed
-- =====================================================
-- Note: We don't drop it, just leave it in place
-- The Edge Function will now be the primary path

-- Add comment for documentation
COMMENT ON FUNCTION public.call_distribute_liquidity_edge IS 'Calls the distribute-liquidity Edge Function asynchronously. All business logic (reads, checks, calculations) happens in the Edge Function. The Edge Function then calls commit_distribution_batch() to write atomically.';