-- =====================================================
-- MISSION CENTER: The "Earn More Money" System
-- =====================================================
-- Users can complete simple tasks to earn extra cash
-- while waiting for their cycle payouts.

-- Create mission_type enum
CREATE TYPE public.mission_type AS ENUM (
  'status_share',      -- Share to WhatsApp Status
  'facebook_share',    -- Share on Facebook
  'telegram_join',     -- Join Telegram group
  'whatsapp_join',     -- Join WhatsApp group
  'referral_milestone' -- Bring X friends
);

-- Create mission_status enum
CREATE TYPE public.mission_status AS ENUM (
  'pending_review',    -- Waiting for admin to check
  'approved',          -- Admin approved, reward paid
  'rejected'           -- Admin rejected with reason
);

-- =====================================================
-- TABLE: missions (The Task Catalog)
-- =====================================================
CREATE TABLE public.missions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  instructions TEXT NOT NULL,  -- Step-by-step guide for users
  mission_type mission_type NOT NULL,
  reward_amount NUMERIC NOT NULL DEFAULT 100,
  daily_limit INTEGER NOT NULL DEFAULT 1,  -- How many times per day
  lifetime_limit INTEGER DEFAULT NULL,  -- NULL = unlimited, 1 = one-time task
  requires_proof BOOLEAN NOT NULL DEFAULT true,  -- Does admin need to verify screenshot?
  is_active BOOLEAN NOT NULL DEFAULT true,
  icon_name TEXT NOT NULL DEFAULT 'zap',  -- Lucide icon name
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

-- Everyone can view active missions
CREATE POLICY "Anyone can view active missions"
ON public.missions
FOR SELECT
USING (is_active = true);

-- Admins can manage missions
CREATE POLICY "Admins can manage missions"
ON public.missions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- TABLE: mission_completions (User Progress)
-- =====================================================
CREATE TABLE public.mission_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  proof_url TEXT,  -- Screenshot proof if required
  status mission_status NOT NULL DEFAULT 'pending_review',
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES public.profiles(id),
  rejection_reason TEXT,
  reward_paid BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.mission_completions ENABLE ROW LEVEL SECURITY;

-- Users can view their own completions
CREATE POLICY "Users can view their own mission completions"
ON public.mission_completions
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own completions
CREATE POLICY "Users can submit mission completions"
ON public.mission_completions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all completions
CREATE POLICY "Admins can view all mission completions"
ON public.mission_completions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update completions (approve/reject)
CREATE POLICY "Admins can update mission completions"
ON public.mission_completions
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Service role can manage all completions
CREATE POLICY "Service role can manage all mission completions"
ON public.mission_completions
FOR ALL
USING (auth.role() = 'service_role');

-- Create index for faster queries
CREATE INDEX idx_mission_completions_user_id ON public.mission_completions(user_id);
CREATE INDEX idx_mission_completions_mission_id ON public.mission_completions(mission_id);
CREATE INDEX idx_mission_completions_status ON public.mission_completions(status);
CREATE INDEX idx_mission_completions_user_date ON public.mission_completions(user_id, completed_at);

-- =====================================================
-- ADD mission_reward to transaction_type enum
-- =====================================================
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'mission_reward';

-- =====================================================
-- SEED INITIAL MISSIONS
-- =====================================================
INSERT INTO public.missions (name, description, instructions, mission_type, reward_amount, daily_limit, lifetime_limit, requires_proof, icon_name, sort_order)
VALUES
  (
    'WhatsApp Status Share',
    'Post our flyer to your WhatsApp Status and earn ₦100. Keep it up for 20 hours!',
    '1. Save today''s flyer from our group or use your screenshot\n2. Post it to your WhatsApp Status\n3. Wait for at least 10 views\n4. Take a screenshot showing the view count\n5. Upload the screenshot here',
    'status_share',
    100,
    1,
    NULL,  -- Can do daily
    true,
    'share-2',
    1
  ),
  (
    'Join WhatsApp Group',
    'Join our official WhatsApp group and stay updated. One-time reward!',
    '1. Click the link to join our WhatsApp group\n2. Once you''re in, take a screenshot showing you''re a member\n3. Upload the screenshot here',
    'whatsapp_join',
    50,
    1,
    1,  -- One-time only
    true,
    'message-circle',
    2
  ),
  (
    'Follow on Facebook',
    'Follow our Facebook page and react to our latest post. One-time reward!',
    '1. Go to our Facebook page and click Follow\n2. Find our latest post and react to it (Like, Love, etc.)\n3. Take a screenshot showing you follow us\n4. Upload the screenshot here',
    'facebook_share',
    50,
    1,
    1,  -- One-time only
    true,
    'facebook',
    3
  ),
  (
    'Join Telegram Channel',
    'Join our Telegram channel for announcements. One-time reward!',
    '1. Click the link to join our Telegram channel\n2. Once you''re in, take a screenshot showing you''re a member\n3. Upload the screenshot here',
    'telegram_join',
    20,
    1,
    1,  -- One-time only
    true,
    'send',
    4
  );

-- =====================================================
-- FUNCTION: Check if user can complete mission today
-- =====================================================
CREATE OR REPLACE FUNCTION public.can_complete_mission(
  _user_id UUID,
  _mission_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mission RECORD;
  _today_count INTEGER;
  _lifetime_count INTEGER;
  _result JSONB;
BEGIN
  -- Get mission details
  SELECT * INTO _mission FROM missions WHERE id = _mission_id AND is_active = true;
  
  IF _mission IS NULL THEN
    RETURN jsonb_build_object('can_complete', false, 'reason', 'Mission not found or inactive');
  END IF;
  
  -- Count today's completions (any status counts - prevents spam)
  SELECT COUNT(*) INTO _today_count
  FROM mission_completions
  WHERE user_id = _user_id 
    AND mission_id = _mission_id
    AND completed_at::date = CURRENT_DATE;
  
  IF _today_count >= _mission.daily_limit THEN
    RETURN jsonb_build_object('can_complete', false, 'reason', 'Daily limit reached');
  END IF;
  
  -- Check lifetime limit if set
  IF _mission.lifetime_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO _lifetime_count
    FROM mission_completions
    WHERE user_id = _user_id 
      AND mission_id = _mission_id
      AND status = 'approved';
    
    IF _lifetime_count >= _mission.lifetime_limit THEN
      RETURN jsonb_build_object('can_complete', false, 'reason', 'Already completed this task');
    END IF;
  END IF;
  
  RETURN jsonb_build_object('can_complete', true, 'reason', NULL);
END;
$$;

-- =====================================================
-- FUNCTION: Get user's mission stats for today
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_user_mission_stats(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today_earnings NUMERIC;
  _total_earnings NUMERIC;
  _pending_count INTEGER;
BEGIN
  -- Today's approved earnings
  SELECT COALESCE(SUM(m.reward_amount), 0) INTO _today_earnings
  FROM mission_completions mc
  JOIN missions m ON m.id = mc.mission_id
  WHERE mc.user_id = _user_id 
    AND mc.status = 'approved'
    AND mc.reviewed_at::date = CURRENT_DATE;
  
  -- Total lifetime approved earnings
  SELECT COALESCE(SUM(m.reward_amount), 0) INTO _total_earnings
  FROM mission_completions mc
  JOIN missions m ON m.id = mc.mission_id
  WHERE mc.user_id = _user_id 
    AND mc.status = 'approved';
  
  -- Pending reviews
  SELECT COUNT(*) INTO _pending_count
  FROM mission_completions
  WHERE user_id = _user_id AND status = 'pending_review';
  
  RETURN jsonb_build_object(
    'today_earnings', _today_earnings,
    'total_earnings', _total_earnings,
    'pending_count', _pending_count
  );
END;
$$;

-- =====================================================
-- STORAGE BUCKET for mission proofs
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mission-proofs',
  'mission-proofs',
  true,  -- Public so we can display screenshots
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for mission proofs
CREATE POLICY "Users can upload their own mission proofs"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'mission-proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view mission proofs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'mission-proofs');

CREATE POLICY "Users can delete their own mission proofs"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'mission-proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);