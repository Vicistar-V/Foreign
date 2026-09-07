-- Fix the call_distribute_liquidity_edge function with correct pg_net syntax
CREATE OR REPLACE FUNCTION public.call_distribute_liquidity_edge(
  _origin_drop_id UUID,
  _amount NUMERIC,
  _max_depth INTEGER DEFAULT 100
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net', 'extensions'
AS $$
DECLARE
  v_request_id BIGINT;
BEGIN
  -- Make async HTTP POST using correct pg_net syntax
  -- Using anon key (public) - Edge Function creates its own service role client
  SELECT net.http_post(
    url := 'https://sbprvewcfrtazdlcfvxt.supabase.co/functions/v1/distribute-liquidity',
    body := jsonb_build_object(
      'origin_drop_id', _origin_drop_id,
      'amount', _amount,
      'max_depth', _max_depth
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNicHJ2ZXdjZnJ0YXpkbGNmdnh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mzc3ODIsImV4cCI6MjA3OTIxMzc4Mn0.-dqqGd8WOaZG-ScJVhHLnFpRDXHSQ8Xq9WxdQ63OI2w'
    ),
    timeout_milliseconds := 30000
  ) INTO v_request_id;
  
  RETURN json_build_object(
    'success', true,
    'async', true,
    'request_id', v_request_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Edge function call failed: %', SQLERRM;
    RETURN json_build_object(
      'success', false,
      'async', false,
      'error', SQLERRM
    );
END;
$$;

-- Clean up test data: Remove the drop that failed to distribute
DELETE FROM drops WHERE id = '42ace266-0c9a-4ac7-be62-2dc7cba70270';

-- Get the spot_id from the deleted drop and remove the spot
DELETE FROM spots WHERE id IN (
  SELECT spot_id FROM drops WHERE id = '42ace266-0c9a-4ac7-be62-2dc7cba70270'
);

-- Remove related transactions (drop_entry for this test)
-- Find the most recent drop_entry transaction and delete it
DELETE FROM transactions 
WHERE id = (
  SELECT id FROM transactions 
  WHERE transaction_type = 'drop_entry' 
  ORDER BY created_at DESC 
  LIMIT 1
);