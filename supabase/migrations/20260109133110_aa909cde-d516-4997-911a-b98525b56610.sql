-- Remove redundant DELETE FROM cached_balances from pay_user_profit
-- The trigger update_cached_balances_on_transaction already handles cache updates
-- Having both causes a race condition where the trigger updates, then the function deletes

CREATE OR REPLACE FUNCTION pay_user_profit(
  _user_id UUID,
  _spot_id UUID,
  _auto_compound BOOLEAN DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_spot RECORD;
  v_profile RECORD;
  v_actual_profit NUMERIC;
  v_is_first_cycle BOOLEAN;
BEGIN
  -- Get spot genesis status
  SELECT is_genesis_spot, genesis_yields_remaining
  INTO v_spot
  FROM spots WHERE id = _spot_id;

  -- Get profile data
  SELECT first_cycle_completed_at, referred_by_code
  INTO v_profile
  FROM profiles WHERE id = _user_id;
  
  -- Step 1: Determine if first cycle
  v_is_first_cycle := (v_profile.first_cycle_completed_at IS NULL);
  
  -- Step 2: Get correct profit amount (₦400 or ₦900)
  v_actual_profit := get_user_profit_amount(_user_id);
  
  -- Step 3: Handle first cycle completion (mark + pay ₦500 bonus)
  IF v_is_first_cycle THEN
    PERFORM mark_first_cycle_done(_user_id, v_profile.referred_by_code);
  END IF;

  -- Step 4: Route to genesis or normal payout
  IF v_spot.is_genesis_spot AND v_spot.genesis_yields_remaining > 0 THEN
    -- Genesis mode: pay to deposit wallet
    PERFORM pay_genesis_yield(_user_id, _spot_id, v_actual_profit, v_is_first_cycle);
    RETURN; -- Genesis handled everything
  END IF;

  -- Step 5: Normal payout to earnings wallet
  INSERT INTO transactions (
    user_id, amount, transaction_type, wallet_type, description, status, metadata
  ) VALUES (
    _user_id,
    v_actual_profit,
    'drop_profit',
    'earnings',
    CASE 
      WHEN v_is_first_cycle THEN 'First cycle payout - Welcome to Viketa!'
      WHEN _auto_compound THEN 'Machine payout - Empire Builder active'
      ELSE 'Machine payout - Ready to withdraw!'
    END,
    'completed',
    json_build_object(
      'auto_compounded', _auto_compound,
      'is_first_cycle', v_is_first_cycle,
      'profit_amount', v_actual_profit
    )
  );
  
  -- Step 6: Try auto-compound if enabled
  IF _auto_compound THEN
    PERFORM try_auto_buy_machine(_user_id);
  END IF;
  
  -- NOTE: Cache update is handled automatically by the trigger
  -- update_cached_balances_on_transaction - no DELETE needed here!
END;
$$;