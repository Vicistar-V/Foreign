-- Remove DELETE FROM cached_balances from payout functions
-- The trigger now handles all cache updates automatically

-- 1. Update pay_user_profit: Remove the DELETE statement
CREATE OR REPLACE FUNCTION public.pay_user_profit(_user_id uuid, _spot_id uuid, _profit_amount numeric, _auto_compound boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_spot RECORD;
  v_profile RECORD;
  v_config RECORD;
  v_actual_profit NUMERIC;
  v_is_first_cycle BOOLEAN;
  v_has_referrer BOOLEAN;
BEGIN
  -- Get spot data including genesis status
  SELECT is_genesis_spot, genesis_yields_remaining
  INTO v_spot
  FROM spots WHERE id = _spot_id;
  
  -- Get profile data
  SELECT first_cycle_completed_at, referred_by_code, auto_compound_enabled
  INTO v_profile
  FROM profiles WHERE id = _user_id;
  
  -- Get config
  SELECT drop_referral_per_cycle INTO v_config FROM platform_config WHERE id = 1;
  
  -- Determine if this is first cycle
  v_is_first_cycle := (v_profile.first_cycle_completed_at IS NULL);
  
  -- Check if user has a referrer
  v_has_referrer := (v_profile.referred_by_code IS NOT NULL 
                     AND v_profile.referred_by_code != '' 
                     AND v_profile.referred_by_code != 'SYSTEM');
  
  -- Get the correct profit amount for this user
  v_actual_profit := get_user_profit_amount(_user_id);
  
  -- Handle first cycle completion (mark it BEFORE paying)
  IF v_is_first_cycle THEN
    PERFORM mark_first_cycle_done(_user_id, v_profile.referred_by_code);
  END IF;
  
  -- GENESIS PATH: If genesis spot with yields remaining, route to genesis handler
  IF v_spot.is_genesis_spot AND v_spot.genesis_yields_remaining > 0 THEN
    PERFORM pay_genesis_yield(_user_id, _spot_id, v_actual_profit, v_is_first_cycle);
    RETURN;
  END IF;
  
  -- NORMAL PATH: Pay to earnings wallet
  INSERT INTO transactions (
    user_id, amount, transaction_type, wallet_type, description, status, metadata
  ) VALUES (
    _user_id,
    v_actual_profit,
    'drop_profit',
    'earnings',
    CASE 
      WHEN v_is_first_cycle THEN 'First machine payout - Welcome to Viketa!'
      WHEN _auto_compound THEN 'Machine payout (Empire Builder active)'
      ELSE 'Machine payout - Ready to withdraw!'
    END,
    'completed',
    json_build_object(
      'spot_id', _spot_id,
      'auto_compounded', _auto_compound,
      'is_first_cycle', v_is_first_cycle,
      'profit_amount', v_actual_profit
    )
  );
  
  -- Pay per-cycle referral bonus (₦20 per cycle if user has referrer)
  IF v_has_referrer AND v_config.drop_referral_per_cycle > 0 THEN
    PERFORM pay_referral_bonus(v_profile.referred_by_code, _user_id, v_config.drop_referral_per_cycle);
  END IF;
  
  -- Send payout notification
  PERFORM send_payout_notification(_user_id, v_actual_profit, _auto_compound);
  
  -- If auto-compound is enabled, try to buy a new machine
  IF _auto_compound OR v_profile.auto_compound_enabled THEN
    PERFORM try_auto_buy_machine(_user_id);
  END IF;
  
  -- Cache is automatically updated by trigger - NO DELETE needed!
END;
$function$;

-- 2. Update pay_genesis_yield: Remove the DELETE statement
CREATE OR REPLACE FUNCTION public.pay_genesis_yield(_user_id uuid, _spot_id uuid, _amount numeric, _is_first_cycle boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_spot RECORD;
  v_config RECORD;
  v_deposit_balance NUMERIC;
  v_leftover NUMERIC;
  v_spot_result JSON;
BEGIN
  -- Get spot data
  SELECT genesis_yields_remaining INTO v_spot
  FROM spots WHERE id = _spot_id;
  
  -- Get config
  SELECT drop_entry_fee INTO v_config FROM platform_config WHERE id = 1;
  
  -- Pay to DEPOSIT wallet (locked for genesis)
  INSERT INTO transactions (
    user_id, amount, transaction_type, wallet_type, description, status, metadata
  ) VALUES (
    _user_id,
    _amount,
    'genesis_yield',
    'deposit',
    format('Genesis cycle %s/3 - Building your second machine...', 4 - v_spot.genesis_yields_remaining),
    'completed',
    json_build_object(
      'genesis_cycle', 4 - v_spot.genesis_yields_remaining, 
      'spot_id', _spot_id,
      'is_first_cycle', _is_first_cycle
    )
  );
  
  -- Decrement genesis counter
  UPDATE spots 
  SET genesis_yields_remaining = genesis_yields_remaining - 1
  WHERE id = _spot_id;
  
  -- Check if this was the 3rd cycle (counter was 1, now becomes 0)
  IF v_spot.genesis_yields_remaining = 1 THEN
    
    -- Get deposit balance AFTER this transaction
    SELECT check_balance(_user_id, 'deposit') INTO v_deposit_balance;
    
    -- Should have enough for a new machine
    IF v_deposit_balance >= v_config.drop_entry_fee THEN
      
      -- Auto-buy Machine 2 from deposit wallet!
      SELECT create_spot(_user_id, 'deposit') INTO v_spot_result;
      
      IF (v_spot_result->>'success')::boolean THEN
        -- Move leftover to earnings
        SELECT check_balance(_user_id, 'deposit') INTO v_leftover;
        
        IF v_leftover > 0 THEN
          -- Transfer out of deposit
          INSERT INTO transactions (
            user_id, amount, transaction_type, wallet_type, description, status, metadata
          ) VALUES (
            _user_id, 
            -v_leftover, 
            'genesis_transfer', 
            'deposit', 
            'Genesis complete - transferring bonus',
            'completed',
            json_build_object('transfer_type', 'genesis_leftover')
          );
          
          -- Transfer into earnings
          INSERT INTO transactions (
            user_id, amount, transaction_type, wallet_type, description, status, metadata
          ) VALUES (
            _user_id, 
            v_leftover, 
            'genesis_transfer', 
            'earnings', 
            format('Genesis bonus! ₦%s ready to withdraw!', v_leftover),
            'completed',
            json_build_object('transfer_type', 'genesis_bonus')
          );
        END IF;
        
        -- Mark genesis complete on profile
        UPDATE profiles 
        SET genesis_completed_at = now() 
        WHERE id = _user_id;
        
        -- Celebrate with notification!
        PERFORM create_notification(
          _user_id := _user_id,
          _type := 'genesis_complete',
          _title := 'GENESIS COMPLETE! You now own 2 machines!',
          _message := format('Your first 3 payouts built you %s. Welcome to the Viketa Empire! You also got ₦%s bonus to withdraw.', 
            v_spot_result->>'spot_name', COALESCE(v_leftover, 0))
        );
      END IF;
    END IF;
  ELSE
    -- Not the 3rd cycle yet, just notify progress
    PERFORM create_notification(
      _user_id := _user_id,
      _type := 'genesis_progress',
      _title := format('Genesis Cycle %s/3 Complete!', 4 - v_spot.genesis_yields_remaining + 1),
      _message := format('₦%s added to your genesis fund. %s more cycle(s) until your second machine is built!', 
        _amount, v_spot.genesis_yields_remaining - 1)
    );
  END IF;
  
  -- Cache is automatically updated by trigger - NO DELETE needed!
END;
$function$;

-- 3. Initialize missing cache records for Victor and Vivian
SELECT refresh_user_cache('b23d5dd6-3f5d-49a7-8ad9-62a1feb17dc2');
SELECT refresh_user_cache('dae463a3-767c-46fe-bed7-a9d27f9a4548');