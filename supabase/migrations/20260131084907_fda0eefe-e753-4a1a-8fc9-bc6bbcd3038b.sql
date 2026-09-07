-- ============================================
-- Update Lead Generator: Change from 5 to 3 referrals
-- ============================================

-- 1. Update check_daily_referrals function
CREATE OR REPLACE FUNCTION public.check_daily_referrals(_user_id UUID)
RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _referral_code TEXT;
  _today_count INTEGER;
  _nigerian_today DATE;
BEGIN
  -- Get current date in Nigerian timezone (Africa/Lagos = UTC+1)
  _nigerian_today := (NOW() AT TIME ZONE 'Africa/Lagos')::DATE;
  
  -- Get user's referral code
  SELECT referral_code INTO _referral_code 
  FROM profiles 
  WHERE id = _user_id;
  
  IF _referral_code IS NULL THEN
    RETURN jsonb_build_object(
      'today_referrals', 0,
      'goal', 3,
      'goal_reached', false,
      'nigerian_date', _nigerian_today::text
    );
  END IF;
  
  -- Count people who registered TODAY (Nigerian time) using this referral code
  SELECT COUNT(*) INTO _today_count
  FROM profiles
  WHERE referred_by_code = _referral_code
    AND (created_at AT TIME ZONE 'Africa/Lagos')::DATE = _nigerian_today;
  
  RETURN jsonb_build_object(
    'today_referrals', _today_count,
    'goal', 3,
    'goal_reached', _today_count >= 3,
    'nigerian_date', _nigerian_today::text
  );
END;
$$;

-- 2. Update claim_lead_generator_reward function
CREATE OR REPLACE FUNCTION public.claim_lead_generator_reward(_user_id UUID, _mission_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _referral_data JSONB;
  _nigerian_today DATE;
  _already_claimed BOOLEAN;
  _completion_id UUID;
  _reward_amount INTEGER := 200;
BEGIN
  -- Get Nigerian date
  _nigerian_today := (NOW() AT TIME ZONE 'Africa/Lagos')::DATE;
  
  -- Check if already claimed today (Nigerian time)
  SELECT EXISTS(
    SELECT 1 FROM mission_completions
    WHERE user_id = _user_id 
      AND mission_id = _mission_id
      AND (completed_at AT TIME ZONE 'Africa/Lagos')::DATE = _nigerian_today
      AND status IN ('pending_review', 'approved')
  ) INTO _already_claimed;
  
  IF _already_claimed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You already claimed this reward today. Come back tomorrow!'
    );
  END IF;
  
  -- Check referral count
  SELECT public.check_daily_referrals(_user_id) INTO _referral_data;
  
  IF NOT (_referral_data->>'goal_reached')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You need ' || (3 - (_referral_data->>'today_referrals')::int) || ' more signups to claim this reward'
    );
  END IF;
  
  -- Auto-approve and create completion
  INSERT INTO mission_completions (
    user_id, 
    mission_id, 
    status, 
    text_proof,
    reward_paid
  ) VALUES (
    _user_id, 
    _mission_id, 
    'approved',
    'Auto-verified: ' || (_referral_data->>'today_referrals')::int || ' referrals on ' || _nigerian_today::text,
    true
  )
  RETURNING id INTO _completion_id;
  
  -- Credit earnings wallet
  INSERT INTO transactions (
    user_id,
    amount,
    transaction_type,
    wallet_type,
    status,
    description
  ) VALUES (
    _user_id,
    _reward_amount,
    'mission_reward',
    'earnings',
    'completed',
    'Lead Generator reward - ' || (_referral_data->>'today_referrals')::int || ' signups'
  );
  
  -- Update cached balance
  UPDATE cached_balances 
  SET earnings_balance = earnings_balance + _reward_amount,
      last_updated = NOW()
  WHERE user_id = _user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'reward', _reward_amount,
    'completion_id', _completion_id
  );
END;
$$;

-- 3. Update mission description and instructions
UPDATE missions 
SET 
  description = 'Get 3 friends to sign up FREE today and earn ₦200! No payment needed from them.',
  instructions = '1. Share your referral link with friends and family
2. Get 3 people to create FREE accounts (just signup, no payment needed!)
3. Once 3 friends register with your link, tap "Claim Reward"
4. The system automatically checks your referrals',
  updated_at = NOW()
WHERE name = 'Lead Generator';