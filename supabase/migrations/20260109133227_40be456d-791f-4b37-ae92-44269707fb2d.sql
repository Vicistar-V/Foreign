-- Create a simple function to refresh a user's cached balance
-- Inserts a zero-amount transaction to trigger the cache update trigger

CREATE OR REPLACE FUNCTION refresh_user_cache(_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO transactions (
    user_id, 
    amount, 
    transaction_type, 
    wallet_type, 
    description, 
    status
  ) VALUES (
    _user_id,
    0,
    'deposit',
    'earnings',
    'System cache refresh',
    'completed'
  );
END;
$$;

-- Now call it for Chinedu
SELECT refresh_user_cache('f73e5c41-41cf-4a8a-a64c-1d4aacf5e4f3');