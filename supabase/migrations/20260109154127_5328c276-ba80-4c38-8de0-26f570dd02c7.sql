
-- Complete Abubakar Ishaq's genesis and set up his new spot
-- User ID: 76c346ab-5ae4-4835-8202-180ebd9df801

DO $$
DECLARE
  _user_id UUID := '76c346ab-5ae4-4835-8202-180ebd9df801';
  _genesis_spot_id UUID;
  _remaining_balance NUMERIC;
  _new_spot_result JSON;
  _transfer_result JSON;
BEGIN
  -- Get genesis spot ID
  SELECT id INTO _genesis_spot_id 
  FROM spots 
  WHERE user_id = _user_id AND is_genesis_spot = true;

  -- 1. Pay final genesis yield (₦900 to deposit wallet)
  PERFORM pay_genesis_yield(_user_id, _genesis_spot_id, 900.00, false);

  -- 2. Mark genesis complete and update spot (use 'closed' as valid status)
  UPDATE profiles 
  SET genesis_completed_at = NOW() 
  WHERE id = _user_id;

  UPDATE spots 
  SET genesis_yields_remaining = 0, status = 'closed'
  WHERE id = _genesis_spot_id;

  -- 3. Create new spot using deposit wallet (costs ₦2,000)
  SELECT create_spot(_user_id, 'deposit'::wallet_type) INTO _new_spot_result;
  
  RAISE NOTICE 'New spot created: %', _new_spot_result;

  -- 4. Get remaining balance after spot purchase
  SELECT deposit_balance INTO _remaining_balance 
  FROM cached_balances 
  WHERE user_id = _user_id;

  RAISE NOTICE 'Remaining deposit: %', _remaining_balance;

  -- 5. Transfer remaining deposit to earnings
  IF _remaining_balance > 0 THEN
    SELECT atomic_wallet_transfer(
      _user_id,
      'deposit'::wallet_type,
      'earnings'::wallet_type,
      _remaining_balance,
      'Genesis complete - balance moved to earnings'
    ) INTO _transfer_result;
    
    RAISE NOTICE 'Transfer result: %', _transfer_result;
  END IF;

  -- 6. Refresh user cache
  PERFORM refresh_user_cache(_user_id);

  -- 7. Send celebration notification
  INSERT INTO notifications (user_id, title, message, notification_type, metadata)
  VALUES (
    _user_id,
    '🎉 Genesis Complete!',
    'Congratulations! Your genesis phase is done. You now have a new machine working for you, and your remaining balance has been moved to your earnings wallet ready to withdraw anytime!',
    'system',
    '{"show_as_modal": true}'::jsonb
  );
END $$;
