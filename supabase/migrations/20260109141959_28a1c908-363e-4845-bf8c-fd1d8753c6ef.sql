
DO $$
DECLARE
  v_user_id UUID := '647b68e1-7a74-4f8a-8232-ad7d3f152705';
  v_spot_id UUID := '7d5db9fc-dc0b-4795-a88a-3829bca37985';
  v_deposit_balance NUMERIC := 800;
  v_spot_cost NUMERIC := 1000;
BEGIN
  -- Step 1: Transfer ₦800 from deposit to earnings (complete the genesis)
  INSERT INTO transactions (user_id, amount, transaction_type, wallet_type, description, status, metadata)
  VALUES 
    (v_user_id, -v_deposit_balance, 'genesis_transfer', 'deposit', 
     'Genesis complete - transferring remaining balance', 'completed',
     json_build_object('fix_type', 'genesis_completion', 'fixed_at', now())),
    (v_user_id, v_deposit_balance, 'genesis_transfer', 'earnings',
     'Genesis bonus! ₦800 ready to use!', 'completed',
     json_build_object('fix_type', 'genesis_completion', 'fixed_at', now()));
  
  -- Step 2: Mark spot genesis as done
  UPDATE spots SET genesis_yields_remaining = 0 WHERE id = v_spot_id;
  
  -- Step 3: Mark profile genesis as complete
  UPDATE profiles SET genesis_completed_at = now() WHERE id = v_user_id;
  
  -- Step 4: Move ₦1,000 from earnings to deposit for new spot purchase
  INSERT INTO transactions (user_id, amount, transaction_type, wallet_type, description, status, metadata)
  VALUES 
    (v_user_id, -v_spot_cost, 'drop_entry', 'earnings', 
     'Money moved to buy new spot', 'completed',
     json_build_object('purpose', 'auto_buy_machine')),
    (v_user_id, v_spot_cost, 'drop_entry', 'deposit',
     'Money ready for new spot', 'completed',
     json_build_object('purpose', 'auto_buy_machine'));
  
  -- NO refresh_user_cache - let the trigger test itself!
END $$;
