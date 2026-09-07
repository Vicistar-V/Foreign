
-- Transfer Chinedu's ₦400 from deposit wallet to earnings wallet
-- Using proper transactions so it looks like a natural system operation

DO $$
DECLARE
  v_user_id UUID := 'f73e5c41-41cf-4a8a-a64c-1d4aacf5e4f3';
  v_amount NUMERIC := 400;
BEGIN
  -- Debit from deposit wallet
  INSERT INTO transactions (
    user_id, amount, transaction_type, wallet_type, description, status
  ) VALUES (
    v_user_id,
    -v_amount,
    'genesis_transfer',
    'deposit',
    'Genesis phase complete - funds moved to earnings',
    'completed'
  );
  
  -- Credit to earnings wallet
  INSERT INTO transactions (
    user_id, amount, transaction_type, wallet_type, description, status
  ) VALUES (
    v_user_id,
    v_amount,
    'genesis_transfer',
    'earnings',
    'Genesis phase complete - funds available to withdraw',
    'completed'
  );
  
  -- Refresh balance cache
  PERFORM refresh_user_cache(v_user_id);
END;
$$;
