-- ============================================
-- GROWTH TASKS: Functions and Missions
-- All daily resets use Nigerian Time (Africa/Lagos, UTC+1)
-- If user completes at 11:59 PM, they can do again at 12:00 AM
-- ============================================

-- 1. Function to check daily referrals in NIGERIAN TIME
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
      'goal', 5,
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
    'goal', 5,
    'goal_reached', _today_count >= 5,
    'nigerian_date', _nigerian_today::text
  );
END;
$$;

-- 2. Function to claim Lead Generator reward (auto-verified)
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
      'error', 'You need ' || (5 - (_referral_data->>'today_referrals')::int) || ' more signups to claim this reward'
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

-- 3. Function to check if user can submit nudge (5x daily limit in Nigerian time)
CREATE OR REPLACE FUNCTION public.check_nudge_daily_limit(_user_id UUID, _mission_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _nigerian_today DATE;
  _today_submissions INTEGER;
  _daily_limit INTEGER := 5;
BEGIN
  -- Get Nigerian date
  _nigerian_today := (NOW() AT TIME ZONE 'Africa/Lagos')::DATE;
  
  -- Count today's submissions (Nigerian time)
  SELECT COUNT(*) INTO _today_submissions
  FROM mission_completions
  WHERE user_id = _user_id 
    AND mission_id = _mission_id
    AND (completed_at AT TIME ZONE 'Africa/Lagos')::DATE = _nigerian_today
    AND status IN ('pending_review', 'approved');
  
  RETURN jsonb_build_object(
    'today_submissions', _today_submissions,
    'daily_limit', _daily_limit,
    'can_submit', _today_submissions < _daily_limit,
    'remaining', GREATEST(0, _daily_limit - _today_submissions),
    'nigerian_date', _nigerian_today::text
  );
END;
$$;

-- 4. Insert the two growth missions
INSERT INTO missions (
  name, 
  description, 
  instructions, 
  mission_type, 
  reward_amount, 
  daily_limit, 
  lifetime_limit, 
  requires_proof, 
  proof_type, 
  icon_name, 
  sort_order,
  is_active
) VALUES 
(
  'Lead Generator',
  'Get 5 friends to sign up FREE today and earn ₦200! No payment needed from them.',
  '1. Share your referral link with friends and family
2. Get 5 people to create FREE accounts (just signup, no payment needed!)
3. Once 5 friends register with your link, tap "Claim Reward"
4. The system automatically checks your referrals',
  'growth_task',
  200, 
  1,
  NULL,
  false,
  'none',
  'users', 
  0,
  true
),
(
  'The Nudge (Recovery)',
  'Message your pending referrals to remind them to activate. Earn ₦50 per message!',
  '1. Go to your Team page to see friends who signed up but haven''t paid yet
2. Send them a WhatsApp or SMS reminder message
3. Take a screenshot of the conversation showing your message
4. Upload the screenshot here
5. You can do this up to 5 times per day!',
  'growth_task',
  50, 
  5,
  NULL,
  true,
  'screenshot',
  'message-circle', 
  1,
  true
);

-- 5. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_daily_referrals(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_lead_generator_reward(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_nudge_daily_limit(UUID, UUID) TO authenticated;