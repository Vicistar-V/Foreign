-- Part 1: Turn off auto-compound for Vivian
UPDATE profiles
SET auto_compound_enabled = false
WHERE id = 'dae463a3-767c-46fe-bed7-a9d27f9a4548';

-- Part 2: Ensure default is false for auto_compound_enabled
ALTER TABLE profiles 
ALTER COLUMN auto_compound_enabled SET DEFAULT false;

-- Part 3: Update pay_user_profit to use EARNINGS wallet and add auto-buy logic
CREATE OR REPLACE FUNCTION public.pay_user_profit(
  _user_id UUID,
  _profit_amount NUMERIC,
  _auto_compound BOOLEAN
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_earnings_balance NUMERIC;
  v_entry_fee NUMERIC;
  v_spot_result JSON;
BEGIN
  -- All profits go to earnings wallet (the correct behavior)
  INSERT INTO transactions (
    user_id, amount, transaction_type, wallet_type, description, status, metadata
  ) VALUES (
    _user_id,
    _profit_amount,
    'drop_profit',
    'earnings',
    CASE WHEN _auto_compound 
      THEN 'Machine payout - Empire Builder active'
      ELSE 'Machine payout - Ready to withdraw!'
    END,
    'completed',
    json_build_object('auto_compounded', _auto_compound)
  );
  
  -- If auto-compound is enabled, check if we can auto-buy a new machine
  IF _auto_compound THEN
    -- Get entry fee from config
    SELECT drop_entry_fee INTO v_entry_fee FROM platform_config WHERE id = 1;
    
    -- Check earnings balance
    SELECT check_balance(_user_id, 'earnings') INTO v_earnings_balance;
    
    IF v_earnings_balance >= v_entry_fee THEN
      -- AUTO-BUY: Create a new spot using earnings wallet
      SELECT create_spot(_user_id, 'earnings') INTO v_spot_result;
      
      -- Notify user about auto-purchase
      IF (v_spot_result->>'success')::boolean THEN
        PERFORM create_notification(
          _user_id := _user_id,
          _type := 'auto_compound_purchase',
          _title := 'Empire Builder bought you a new machine!',
          _message := format('Your profits added up to ₦%s, so we automatically bought %s for you!', 
            v_entry_fee, v_spot_result->>'spot_name')
        );
      END IF;
    END IF;
  END IF;
END;
$$;