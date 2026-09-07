-- =====================================================
-- FIX: Restore complete pay_user_profit and fix get_user_profit_amount
-- The simplified version removed genesis handling and utility calls
-- =====================================================

-- STEP 1: Update get_user_profit_amount to handle non-referred first cycle users
-- Non-referred users get ₦900 (no referrer to pay ₦500 to)
-- Referred users get ₦400 (₦500 goes to referrer)
CREATE OR REPLACE FUNCTION get_user_profit_amount(
  _user_id UUID
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_first_cycle_at TIMESTAMPTZ;
  v_referred_by_code TEXT;
  v_has_no_referrer BOOLEAN;
  v_config RECORD;
BEGIN
  -- Get first cycle status and referrer
  SELECT first_cycle_completed_at, referred_by_code 
  INTO v_first_cycle_at, v_referred_by_code
  FROM profiles WHERE id = _user_id;
  
  -- Get config
  SELECT drop_profit_amount, drop_profit_amount_subsequent INTO v_config
  FROM platform_config WHERE id = 1;
  
  -- Check if user has no referrer
  v_has_no_referrer := (v_referred_by_code IS NULL 
                        OR v_referred_by_code = '' 
                        OR v_referred_by_code = 'SYSTEM');
  
  -- Return appropriate amount
  IF v_first_cycle_at IS NULL THEN
    -- First cycle
    IF v_has_no_referrer THEN
      RETURN v_config.drop_profit_amount_subsequent; -- ₦900 (no referrer to pay)
    ELSE
      RETURN v_config.drop_profit_amount; -- ₦400 (referrer gets ₦500)
    END IF;
  ELSE
    RETURN v_config.drop_profit_amount_subsequent; -- ₦900 for subsequent cycles
  END IF;
END;
$$;

-- STEP 2: Restore the COMPLETE pay_user_profit function
-- This version has: genesis handling, utility function calls, auto-compound
CREATE OR REPLACE FUNCTION public.pay_user_profit(
  _user_id UUID, 
  _spot_id UUID, 
  _profit_amount NUMERIC,
  _auto_compound BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  
  -- Step 2: Get correct profit amount (₦400, ₦900, or ₦900 for non-referred)
  v_actual_profit := get_user_profit_amount(_user_id);
  
  -- Step 3: Handle first cycle completion (mark + pay ₦500 bonus if has referrer)
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
  
  -- Invalidate cache
  DELETE FROM cached_balances WHERE user_id = _user_id;
END;
$$;