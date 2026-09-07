-- Fix pay_user_profit to give non-referred first-cycle users full ₦900
-- Also remove redundant cache delete

CREATE OR REPLACE FUNCTION pay_user_profit(
  _user_id UUID,
  _spot_id UUID,
  _profit_amount NUMERIC,
  _auto_compound BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_config platform_config%ROWTYPE;
  v_actual_profit NUMERIC;
  v_is_first_cycle BOOLEAN;
  v_has_no_referrer BOOLEAN;
BEGIN
  -- Get user profile
  SELECT * INTO v_profile FROM profiles WHERE id = _user_id;
  
  -- Get config
  SELECT * INTO v_config FROM platform_config LIMIT 1;
  
  -- Check if first cycle
  v_is_first_cycle := (v_profile.first_cycle_completed_at IS NULL);
  
  -- Check if user has no referrer
  v_has_no_referrer := (v_profile.referred_by_code IS NULL 
                        OR v_profile.referred_by_code = '' 
                        OR v_profile.referred_by_code = 'SYSTEM');
  
  -- Determine actual profit amount
  IF v_is_first_cycle AND v_has_no_referrer THEN
    -- No referrer = no ₦500 bonus to pay out, so user gets full ₦900
    v_actual_profit := COALESCE(v_config.drop_profit_amount_subsequent, 900);
  ELSIF v_is_first_cycle THEN
    -- Has referrer = ₦500 goes to referrer, user gets ₦400
    v_actual_profit := COALESCE(v_config.drop_profit_amount, 400);
  ELSE
    -- Subsequent cycles = ₦900
    v_actual_profit := COALESCE(v_config.drop_profit_amount_subsequent, 900);
  END IF;

  -- Credit user earnings
  INSERT INTO transactions (
    user_id,
    amount,
    transaction_type,
    wallet_type,
    description,
    status
  ) VALUES (
    _user_id,
    v_actual_profit,
    'drop_profit',
    'earnings',
    'Your earnings from drop cycle',
    'completed'
  );

  -- Update spot stats
  PERFORM update_spot_stats(_spot_id, v_actual_profit);

  -- Handle first cycle completion
  IF v_is_first_cycle THEN
    UPDATE profiles 
    SET first_cycle_completed_at = NOW() 
    WHERE id = _user_id;
    
    -- Pay referral bonus only if referrer exists
    IF NOT v_has_no_referrer THEN
      PERFORM pay_first_cycle_referral_bonus(_user_id, v_profile.referred_by_code);
    END IF;
  END IF;

  -- Send notification
  PERFORM send_payout_notification(_user_id, v_actual_profit, _auto_compound);
  
  -- NO DELETE FROM cached_balances here - trigger handles it!
END;
$$;