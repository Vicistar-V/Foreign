-- =====================================================
-- 1. Drop leftover velocity / calibration helper functions (if any still exist)
-- =====================================================
DROP FUNCTION IF EXISTS public.get_community_velocity() CASCADE;
DROP FUNCTION IF EXISTS public.can_user_receive_payout(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_velocity_tier(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_velocity_tier_details(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.increment_simulated_yield(uuid, numeric) CASCADE;

-- =====================================================
-- 2. Drop total_recycled_profit column from profiles (was only used by velocity recycling)
-- =====================================================
ALTER TABLE public.profiles DROP COLUMN IF EXISTS total_recycled_profit;

-- =====================================================
-- 3. Rebuild distribute_liquidity WITHOUT velocity tier checks
--    Every filled drop pays its owner immediately. No recycling.
-- =====================================================
CREATE OR REPLACE FUNCTION public.distribute_liquidity(
  _origin_drop_id uuid,
  _amount numeric,
  _max_depth integer DEFAULT 100
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_remaining NUMERIC := _amount;
  v_distributed NUMERIC := 0;
  v_payouts_made INTEGER := 0;
  v_reentries_made INTEGER := 0;
  v_depth INTEGER := 0;
  v_target_drop RECORD;
  v_config RECORD;
  v_amount_to_fill NUMERIC;
  v_overflow NUMERIC;
  v_spot_owner_id UUID;
  v_should_auto_compound BOOLEAN;
  v_is_first_cycle BOOLEAN;
  v_has_referrer BOOLEAN;
  v_actual_profit NUMERIC;
BEGIN
  -- Get platform config
  SELECT * INTO v_config FROM platform_config WHERE id = 1;

  WHILE v_remaining > 0 AND v_depth < _max_depth LOOP
    v_depth := v_depth + 1;

    -- Find the oldest unfilled drop (excluding the origin)
    SELECT d.*, s.id AS spot_id, s.user_id AS spot_owner_id,
           p.auto_compound_enabled, p.referred_by_code, p.first_cycle_completed_at
    INTO v_target_drop
    FROM drops d
    JOIN spots s ON s.id = d.spot_id
    JOIN profiles p ON p.id = s.user_id
    WHERE d.id != _origin_drop_id
      AND d.status IN ('waiting', 'filling')
      AND d.fill_amount < d.target_amount
    ORDER BY d.position ASC
    LIMIT 1;

    IF v_target_drop IS NULL THEN
      EXIT;
    END IF;

    v_amount_to_fill := LEAST(v_remaining, v_target_drop.target_amount - v_target_drop.fill_amount);

    UPDATE drops
       SET fill_amount = fill_amount + v_amount_to_fill,
           status = CASE WHEN fill_amount + v_amount_to_fill >= target_amount THEN 'completed' ELSE 'filling' END,
           completed_at = CASE WHEN fill_amount + v_amount_to_fill >= target_amount THEN now() ELSE NULL END
     WHERE id = v_target_drop.id;

    v_remaining := v_remaining - v_amount_to_fill;
    v_distributed := v_distributed + v_amount_to_fill;

    IF v_target_drop.fill_amount + v_amount_to_fill >= v_target_drop.target_amount THEN
      v_spot_owner_id := v_target_drop.spot_owner_id;
      v_should_auto_compound := COALESCE(v_target_drop.auto_compound_enabled, false);
      v_is_first_cycle := (v_target_drop.first_cycle_completed_at IS NULL);
      v_has_referrer := (
        v_target_drop.referred_by_code IS NOT NULL
        AND v_target_drop.referred_by_code != ''
        AND v_target_drop.referred_by_code != 'SYSTEM'
      );

      IF v_is_first_cycle THEN
        v_actual_profit := v_config.drop_profit_amount;
      ELSE
        v_actual_profit := v_config.drop_profit_amount_subsequent;
      END IF;

      v_payouts_made := v_payouts_made + 1;

      -- STEP 1: Pay referral bonus (subsequent cycles only)
      IF NOT v_is_first_cycle AND v_has_referrer THEN
        PERFORM pay_referral_bonus(
          v_target_drop.referred_by_code,
          v_spot_owner_id,
          v_config.drop_referral_per_cycle
        );
      END IF;

      -- STEP 2: Pay user profit
      PERFORM pay_user_profit(
        v_spot_owner_id,
        v_target_drop.spot_id,
        v_config.drop_profit_amount,
        v_should_auto_compound
      );

      -- STEP 3: Track last payout time (kept for activity / display)
      UPDATE profiles SET last_payout_at = NOW() WHERE id = v_spot_owner_id;

      -- STEP 4: Pay admin fee
      PERFORM pay_admin_fee(
        v_target_drop.id,
        v_spot_owner_id,
        v_config.drop_admin_fee,
        (NOT v_is_first_cycle AND v_has_referrer)
      );

      -- STEP 5: Update spot stats
      PERFORM update_spot_stats(v_target_drop.spot_id, v_actual_profit);

      -- Mark drop as paid
      UPDATE drops SET status = 'paid', paid_at = now() WHERE id = v_target_drop.id;

      -- STEP 6: Send payout notification (skip while genesis is paying)
      IF NOT (SELECT is_genesis_spot AND genesis_yields_remaining >= 0 FROM spots WHERE id = v_target_drop.spot_id) THEN
        PERFORM send_payout_notification(
          v_spot_owner_id,
          v_actual_profit,
          v_should_auto_compound
        );
      END IF;

      -- STEP 7: Always create re-entry drop
      INSERT INTO drops (spot_id, position, target_amount, fill_amount, status, source_type)
      VALUES (
        v_target_drop.spot_id,
        (SELECT COALESCE(MAX(position), 0) + 1 FROM drops),
        v_config.drop_target_amount,
        0,
        'waiting',
        're-entry'
      );
      v_reentries_made := v_reentries_made + 1;

      -- Overflow stays in the queue
      v_overflow := (v_target_drop.fill_amount + v_amount_to_fill) - v_target_drop.target_amount;
      IF v_overflow > 0 THEN
        v_remaining := v_remaining + v_overflow;
      END IF;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'distributed', v_distributed,
    'payouts_made', v_payouts_made,
    'reentries_made', v_reentries_made,
    'remaining', v_remaining,
    'depth', v_depth
  );
END;
$function$;