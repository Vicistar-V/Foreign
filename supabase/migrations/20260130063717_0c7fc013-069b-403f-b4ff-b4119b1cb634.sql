-- Add distribution_active column to platform_config
-- This controls whether money flows to users (separate from drop_system_active which controls spot creation)

ALTER TABLE public.platform_config 
ADD COLUMN IF NOT EXISTS distribution_active boolean DEFAULT true;

-- Make sure it starts as TRUE (money flowing)
UPDATE public.platform_config SET distribution_active = true WHERE id = 1;

-- ==========================================
-- UPDATE: get_distribution_data to include distribution_active
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_distribution_data(_origin_drop_id uuid, _max_drops integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config JSONB;
  v_drops JSONB;
  v_max_position INTEGER;
BEGIN
  -- Get platform config (NOW INCLUDES distribution_active)
  SELECT jsonb_build_object(
    'drop_entry_fee', drop_entry_fee,
    'drop_target_amount', drop_target_amount,
    'drop_profit_amount', drop_profit_amount,
    'drop_profit_amount_subsequent', drop_profit_amount_subsequent,
    'drop_admin_fee', drop_admin_fee,
    'drop_referral_per_cycle', drop_referral_per_cycle,
    'drop_reentry_amount', drop_reentry_amount,
    'drop_system_active', drop_system_active,
    'distribution_active', distribution_active,
    'velocity_tier_enabled', velocity_tier_enabled,
    'velocity_tier_referral_requirement', velocity_tier_referral_requirement,
    'velocity_tier_cooldown_hours', velocity_tier_cooldown_hours
  ) INTO v_config
  FROM platform_config WHERE id = 1;
  
  -- Get unfilled drops with ALL related data
  SELECT COALESCE(jsonb_agg(row_to_json(d)::jsonb), '[]')
  INTO v_drops
  FROM (
    SELECT 
      d.id as drop_id,
      d.fill_amount,
      d.target_amount,
      d.position,
      d.status,
      d.source_type,
      s.id as spot_id,
      s.user_id as owner_id,
      s.spot_name,
      s.is_genesis_spot,
      s.genesis_yields_remaining,
      p.full_name as owner_name,
      p.auto_compound_enabled,
      p.referred_by_code,
      p.referral_code,
      p.first_cycle_completed_at,
      p.last_payout_at,
      p.total_recycled_profit,
      -- Count active referrals for velocity tier
      (
        SELECT COUNT(*) 
        FROM profiles ref 
        WHERE ref.referred_by_code = p.referral_code 
          AND ref.is_member = true
      ) as active_referrals_count,
      -- Get referrer ID if exists
      (
        SELECT id 
        FROM profiles 
        WHERE referral_code = p.referred_by_code
        LIMIT 1
      ) as referrer_id,
      -- Calculate balances from transactions ledger
      (
        SELECT COALESCE(SUM(amount), 0) 
        FROM transactions 
        WHERE user_id = s.user_id AND wallet_type = 'deposit' AND status = 'completed'
      ) as deposit_balance,
      (
        SELECT COALESCE(SUM(amount), 0) 
        FROM transactions 
        WHERE user_id = s.user_id AND wallet_type = 'earnings' AND status = 'completed'
      ) as earnings_balance,
      -- Spot count for machine numbering
      (SELECT COUNT(*) FROM spots WHERE user_id = s.user_id) as user_spot_count
    FROM drops d
    JOIN spots s ON s.id = d.spot_id
    JOIN profiles p ON p.id = s.user_id
    WHERE d.id != _origin_drop_id
      AND d.status IN ('waiting', 'filling')
      AND d.fill_amount < d.target_amount
    ORDER BY d.position ASC
    LIMIT _max_drops
  ) d;
  
  -- Get current max position for reentries
  SELECT COALESCE(MAX(position), 0) INTO v_max_position FROM drops;
  
  RETURN jsonb_build_object(
    'config', v_config,
    'drops', v_drops,
    'current_max_position', v_max_position
  );
END;
$$;