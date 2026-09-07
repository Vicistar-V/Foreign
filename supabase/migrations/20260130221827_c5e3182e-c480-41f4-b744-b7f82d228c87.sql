-- ===========================================
-- PHASE 1: GAMIFICATION DATABASE FOUNDATION
-- ===========================================

-- 1. Create spin_results table - tracks every spin ever made
CREATE TABLE public.spin_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  spin_type TEXT NOT NULL CHECK (spin_type IN ('daily', 'lucky')),
  result_type TEXT NOT NULL, -- 'nothing', 'cash', 'speed_boost', 'free_spot'
  result_value NUMERIC NOT NULL DEFAULT 0, -- monetary value or 0
  result_label TEXT NOT NULL, -- human readable "₦50 Bonus" or "Try Again"
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast user lookups
CREATE INDEX idx_spin_results_user_id ON public.spin_results(user_id);
CREATE INDEX idx_spin_results_created_at ON public.spin_results(created_at DESC);
CREATE INDEX idx_spin_results_user_daily ON public.spin_results(user_id, spin_type, created_at DESC);

-- 2. Create user_gamification table - tracks streak and spin eligibility
CREATE TABLE public.user_gamification (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_login_date DATE, -- for streak calculation
  last_daily_spin_at TIMESTAMP WITH TIME ZONE, -- when they last did free spin
  streak_day_7_claimed BOOLEAN NOT NULL DEFAULT false,
  streak_day_14_claimed BOOLEAN NOT NULL DEFAULT false,
  streak_day_30_claimed BOOLEAN NOT NULL DEFAULT false,
  total_spins INTEGER NOT NULL DEFAULT 0,
  total_wins NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Create leaderboard_snapshots table - weekly leaderboard history
CREATE TABLE public.leaderboard_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('earnings', 'referrals')),
  rankings JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of {user_id, name, amount, rank}
  prizes_paid BOOLEAN NOT NULL DEFAULT false,
  prizes_paid_at TIMESTAMP WITH TIME ZONE,
  total_prize_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_leaderboard_week ON public.leaderboard_snapshots(week_start, category);

-- 4. Add gamification config columns to platform_config
ALTER TABLE public.platform_config 
ADD COLUMN IF NOT EXISTS daily_spin_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS lucky_spin_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS lucky_spin_cost NUMERIC NOT NULL DEFAULT 200,
ADD COLUMN IF NOT EXISTS streak_rewards_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS leaderboard_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS leaderboard_prize_1 NUMERIC NOT NULL DEFAULT 2000,
ADD COLUMN IF NOT EXISTS leaderboard_prize_2 NUMERIC NOT NULL DEFAULT 1000,
ADD COLUMN IF NOT EXISTS leaderboard_prize_3 NUMERIC NOT NULL DEFAULT 500,
ADD COLUMN IF NOT EXISTS leaderboard_prize_others NUMERIC NOT NULL DEFAULT 100;

-- ===========================================
-- ROW LEVEL SECURITY POLICIES
-- ===========================================

-- spin_results RLS
ALTER TABLE public.spin_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own spin results"
ON public.spin_results FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all spin results"
ON public.spin_results FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage all spin results"
ON public.spin_results FOR ALL
USING (auth.role() = 'service_role');

-- user_gamification RLS
ALTER TABLE public.user_gamification ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own gamification data"
ON public.user_gamification FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all gamification data"
ON public.user_gamification FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage all gamification data"
ON public.user_gamification FOR ALL
USING (auth.role() = 'service_role');

-- leaderboard_snapshots RLS
ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view leaderboard snapshots"
ON public.leaderboard_snapshots FOR SELECT
USING (true);

CREATE POLICY "Service role can manage leaderboard snapshots"
ON public.leaderboard_snapshots FOR ALL
USING (auth.role() = 'service_role');

-- ===========================================
-- DATABASE FUNCTIONS FOR GAMIFICATION
-- ===========================================

-- Function to update streak on login
CREATE OR REPLACE FUNCTION public.update_user_streak(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record user_gamification%ROWTYPE;
  v_today DATE := CURRENT_DATE;
  v_yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
  v_new_streak INTEGER;
  v_streak_broken BOOLEAN := false;
BEGIN
  -- Get or create gamification record
  SELECT * INTO v_record FROM user_gamification WHERE user_id = _user_id;
  
  IF NOT FOUND THEN
    -- Create new record
    INSERT INTO user_gamification (user_id, current_streak, last_login_date)
    VALUES (_user_id, 1, v_today)
    RETURNING * INTO v_record;
    
    RETURN jsonb_build_object(
      'current_streak', 1,
      'longest_streak', 1,
      'streak_broken', false,
      'is_new', true
    );
  END IF;
  
  -- Already logged in today
  IF v_record.last_login_date = v_today THEN
    RETURN jsonb_build_object(
      'current_streak', v_record.current_streak,
      'longest_streak', v_record.longest_streak,
      'streak_broken', false,
      'is_new', false
    );
  END IF;
  
  -- Logged in yesterday - continue streak
  IF v_record.last_login_date = v_yesterday THEN
    v_new_streak := v_record.current_streak + 1;
  ELSE
    -- Streak broken - reset to 1
    v_new_streak := 1;
    v_streak_broken := true;
  END IF;
  
  -- Update record
  UPDATE user_gamification
  SET 
    current_streak = v_new_streak,
    longest_streak = GREATEST(longest_streak, v_new_streak),
    last_login_date = v_today,
    -- Reset claimed flags if streak was broken
    streak_day_7_claimed = CASE WHEN v_streak_broken THEN false ELSE streak_day_7_claimed END,
    streak_day_14_claimed = CASE WHEN v_streak_broken THEN false ELSE streak_day_14_claimed END,
    streak_day_30_claimed = CASE WHEN v_streak_broken THEN false ELSE streak_day_30_claimed END,
    updated_at = now()
  WHERE user_id = _user_id;
  
  RETURN jsonb_build_object(
    'current_streak', v_new_streak,
    'longest_streak', GREATEST(v_record.longest_streak, v_new_streak),
    'streak_broken', v_streak_broken,
    'is_new', false
  );
END;
$$;

-- Function to check daily spin eligibility
CREATE OR REPLACE FUNCTION public.check_daily_spin_eligible(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_spin TIMESTAMP WITH TIME ZONE;
  v_next_spin TIMESTAMP WITH TIME ZONE;
  v_is_eligible BOOLEAN;
  v_seconds_remaining INTEGER;
BEGIN
  SELECT last_daily_spin_at INTO v_last_spin
  FROM user_gamification
  WHERE user_id = _user_id;
  
  IF v_last_spin IS NULL THEN
    RETURN jsonb_build_object(
      'eligible', true,
      'next_spin_at', NULL,
      'seconds_remaining', 0
    );
  END IF;
  
  v_next_spin := v_last_spin + INTERVAL '24 hours';
  v_is_eligible := now() >= v_next_spin;
  v_seconds_remaining := GREATEST(0, EXTRACT(EPOCH FROM (v_next_spin - now()))::INTEGER);
  
  RETURN jsonb_build_object(
    'eligible', v_is_eligible,
    'next_spin_at', v_next_spin,
    'seconds_remaining', v_seconds_remaining
  );
END;
$$;

-- Function to record spin and credit winnings
CREATE OR REPLACE FUNCTION public.record_spin_result(
  _user_id UUID,
  _spin_type TEXT,
  _result_type TEXT,
  _result_value NUMERIC,
  _result_label TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spin_id UUID;
BEGIN
  -- Insert spin result
  INSERT INTO spin_results (user_id, spin_type, result_type, result_value, result_label)
  VALUES (_user_id, _spin_type, _result_type, _result_value, _result_label)
  RETURNING id INTO v_spin_id;
  
  -- Update gamification stats
  INSERT INTO user_gamification (user_id, total_spins, total_wins, last_daily_spin_at)
  VALUES (
    _user_id, 
    1, 
    _result_value,
    CASE WHEN _spin_type = 'daily' THEN now() ELSE NULL END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_spins = user_gamification.total_spins + 1,
    total_wins = user_gamification.total_wins + _result_value,
    last_daily_spin_at = CASE 
      WHEN _spin_type = 'daily' THEN now() 
      ELSE user_gamification.last_daily_spin_at 
    END,
    updated_at = now();
  
  -- Credit winnings to earnings wallet if cash prize
  IF _result_type = 'cash' AND _result_value > 0 THEN
    INSERT INTO transactions (
      user_id,
      amount,
      description,
      transaction_type,
      wallet_type,
      status,
      metadata
    ) VALUES (
      _user_id,
      _result_value,
      'Spin wheel prize: ' || _result_label,
      'membership_bonus',
      'earnings',
      'completed',
      jsonb_build_object('spin_id', v_spin_id, 'spin_type', _spin_type)
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'spin_id', v_spin_id
  );
END;
$$;

-- Function to deduct lucky spin cost
CREATE OR REPLACE FUNCTION public.deduct_lucky_spin_cost(_user_id UUID, _cost NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  -- Check earnings balance first
  v_balance := check_balance(_user_id, 'earnings');
  
  IF v_balance >= _cost THEN
    -- Deduct from earnings
    INSERT INTO transactions (
      user_id,
      amount,
      description,
      transaction_type,
      wallet_type,
      status
    ) VALUES (
      _user_id,
      -_cost,
      'Lucky spin entry fee',
      'platform_fee',
      'earnings',
      'completed'
    );
    
    RETURN jsonb_build_object('success', true, 'wallet', 'earnings');
  END IF;
  
  -- Check deposit balance
  v_balance := check_balance(_user_id, 'deposit');
  
  IF v_balance >= _cost THEN
    -- Deduct from deposit
    INSERT INTO transactions (
      user_id,
      amount,
      description,
      transaction_type,
      wallet_type,
      status
    ) VALUES (
      _user_id,
      -_cost,
      'Lucky spin entry fee',
      'platform_fee',
      'deposit',
      'completed'
    );
    
    RETURN jsonb_build_object('success', true, 'wallet', 'deposit');
  END IF;
  
  RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
END;
$$;

-- Function to claim streak reward
CREATE OR REPLACE FUNCTION public.claim_streak_reward(_user_id UUID, _day INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record user_gamification%ROWTYPE;
  v_reward NUMERIC;
  v_column_name TEXT;
BEGIN
  -- Validate day parameter
  IF _day NOT IN (7, 14, 30) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid reward day');
  END IF;
  
  -- Get gamification record
  SELECT * INTO v_record FROM user_gamification WHERE user_id = _user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No streak data found');
  END IF;
  
  -- Check if streak is high enough
  IF v_record.current_streak < _day THEN
    RETURN jsonb_build_object('success', false, 'error', 'Streak not high enough');
  END IF;
  
  -- Check if already claimed
  IF (_day = 7 AND v_record.streak_day_7_claimed) OR
     (_day = 14 AND v_record.streak_day_14_claimed) OR
     (_day = 30 AND v_record.streak_day_30_claimed) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already claimed');
  END IF;
  
  -- Set reward amount
  v_reward := CASE _day
    WHEN 7 THEN 100
    WHEN 14 THEN 200
    WHEN 30 THEN 500
  END;
  
  -- Mark as claimed
  IF _day = 7 THEN
    UPDATE user_gamification SET streak_day_7_claimed = true, updated_at = now() WHERE user_id = _user_id;
  ELSIF _day = 14 THEN
    UPDATE user_gamification SET streak_day_14_claimed = true, updated_at = now() WHERE user_id = _user_id;
  ELSE
    UPDATE user_gamification SET streak_day_30_claimed = true, updated_at = now() WHERE user_id = _user_id;
  END IF;
  
  -- Credit reward to earnings
  INSERT INTO transactions (
    user_id,
    amount,
    description,
    transaction_type,
    wallet_type,
    status,
    metadata
  ) VALUES (
    _user_id,
    v_reward,
    'Day ' || _day || ' streak bonus',
    'membership_bonus',
    'earnings',
    'completed',
    jsonb_build_object('streak_day', _day)
  );
  
  -- Send notification
  PERFORM create_notification(
    _user_id,
    'streak_reward',
    '🔥 Streak Bonus!',
    'You earned ₦' || v_reward || ' for your ' || _day || '-day streak!',
    '/games'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'reward', v_reward,
    'day', _day
  );
END;
$$;

-- Function to get current week leaderboard
CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard(_category TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start DATE := date_trunc('week', CURRENT_DATE)::DATE;
  v_result JSONB;
BEGIN
  IF _category = 'earnings' THEN
    SELECT jsonb_agg(row_to_json(r)) INTO v_result
    FROM (
      SELECT 
        p.id as user_id,
        p.full_name as name,
        COALESCE(SUM(t.amount), 0) as amount,
        ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(t.amount), 0) DESC) as rank
      FROM profiles p
      LEFT JOIN transactions t ON t.user_id = p.id
        AND t.created_at >= v_week_start
        AND t.amount > 0
        AND t.transaction_type IN ('drop_profit', 'referral_payout', 'genesis_yield', 'referral_first_cycle_bonus')
        AND t.status = 'completed'
      WHERE p.is_member = true
      GROUP BY p.id, p.full_name
      HAVING COALESCE(SUM(t.amount), 0) > 0
      ORDER BY amount DESC
      LIMIT 10
    ) r;
  ELSIF _category = 'referrals' THEN
    SELECT jsonb_agg(row_to_json(r)) INTO v_result
    FROM (
      SELECT 
        p.id as user_id,
        p.full_name as name,
        COUNT(DISTINCT ref.id) as amount,
        ROW_NUMBER() OVER (ORDER BY COUNT(DISTINCT ref.id) DESC) as rank
      FROM profiles p
      LEFT JOIN profiles ref ON ref.referred_by_code = p.referral_code
        AND ref.created_at >= v_week_start
        AND ref.is_member = true
      WHERE p.is_member = true
      GROUP BY p.id, p.full_name
      HAVING COUNT(DISTINCT ref.id) > 0
      ORDER BY amount DESC
      LIMIT 10
    ) r;
  ELSE
    RETURN jsonb_build_object('error', 'Invalid category');
  END IF;
  
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;