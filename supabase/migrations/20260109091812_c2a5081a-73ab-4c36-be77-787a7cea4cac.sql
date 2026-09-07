-- Fix Vivian's stuck Genesis phase
DO $$
DECLARE
  v_user_id UUID := 'dae463a3-767c-46fe-bed7-a9d27f9a4548';
  v_spot_result JSON;
  v_leftover NUMERIC;
BEGIN
  -- Step 1: Create Machine 2 from deposit wallet
  SELECT create_spot(v_user_id, 'deposit') INTO v_spot_result;
  
  IF (v_spot_result->>'success')::boolean THEN
    RAISE NOTICE 'Created spot: %', v_spot_result;
    
    -- Step 2: Get leftover deposit
    SELECT check_balance(v_user_id, 'deposit') INTO v_leftover;
    
    -- Step 3: Move leftover to earnings
    IF v_leftover > 0 THEN
      INSERT INTO transactions (
        user_id, amount, transaction_type, wallet_type, 
        description, status
      ) VALUES (
        v_user_id, -v_leftover, 'genesis_transfer', 'deposit',
        'Genesis complete - moving bonus to earnings', 'completed'
      );
      
      INSERT INTO transactions (
        user_id, amount, transaction_type, wallet_type, 
        description, status
      ) VALUES (
        v_user_id, v_leftover, 'genesis_transfer', 'earnings',
        format('Genesis bonus! ₦%s ready to withdraw!', v_leftover), 'completed'
      );
    END IF;
    
    -- Step 4: Mark genesis complete
    UPDATE profiles 
    SET genesis_completed_at = now() 
    WHERE id = v_user_id;
    
    -- Step 5: Send celebration notification
    PERFORM create_notification(
      _user_id := v_user_id,
      _type := 'genesis_complete',
      _title := '🎉 GENESIS COMPLETE! You now own 2 machines!',
      _message := format('Your genesis fund built you %s. Welcome to the Viketa Empire! You also got ₦%s bonus to withdraw.', 
        v_spot_result->>'spot_name', COALESCE(v_leftover, 0))
    );
    
    -- Clear cache
    DELETE FROM cached_balances WHERE user_id = v_user_id;
  ELSE
    RAISE EXCEPTION 'Failed to create spot: %', v_spot_result->>'error';
  END IF;
END $$;