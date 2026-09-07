-- =====================================================
-- TIER BONUS SYSTEM: Calculate referrer's bonus based on active miners
-- =====================================================

-- Function to get a referrer's tier bonus percentage
CREATE OR REPLACE FUNCTION public.get_referrer_tier_bonus(_referrer_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_active_miners INTEGER;
  v_bonus_percent INTEGER;
  v_referral_code TEXT;
BEGIN
  -- Get the referrer's referral code
  SELECT referral_code INTO v_referral_code
  FROM profiles
  WHERE id = _referrer_id;
  
  IF v_referral_code IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Count active referred members (is_member = true)
  SELECT COUNT(*) INTO v_active_miners
  FROM profiles
  WHERE referred_by_code = v_referral_code
    AND is_member = true;
  
  -- Calculate bonus based on tier
  -- Starter (0 miners): 0%
  -- Bronze (1-4 miners): 0%
  -- Silver (5-19 miners): 5%
  -- Gold (20-49 miners): 10%
  -- Diamond (50+ miners): 15%
  IF v_active_miners >= 50 THEN
    v_bonus_percent := 15;  -- Diamond tier
  ELSIF v_active_miners >= 20 THEN
    v_bonus_percent := 10;  -- Gold tier
  ELSIF v_active_miners >= 5 THEN
    v_bonus_percent := 5;   -- Silver tier
  ELSE
    v_bonus_percent := 0;   -- Starter/Bronze tier
  END IF;
  
  RETURN v_bonus_percent;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_referrer_tier_bonus(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referrer_tier_bonus(UUID) TO service_role;