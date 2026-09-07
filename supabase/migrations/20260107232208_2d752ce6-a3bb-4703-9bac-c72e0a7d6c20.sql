
-- ============================================
-- REFACTOR: Split distribute_liquidity into utility functions
-- ============================================

-- UTILITY 1: Pay referral bonus per cycle
CREATE OR REPLACE FUNCTION pay_referral_bonus(
  _referred_by_code TEXT,
  _referee_id UUID,
  _bonus_amount NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_referrer_id UUID;
BEGIN
  IF _referred_by_code IS NULL OR _bonus_amount <= 0 THEN
    RETURN;
  END IF;
  
  -- Find the referrer
  SELECT id INTO v_referrer_id 
  FROM profiles 
  WHERE referral_code = _referred_by_code;
  
  IF v_referrer_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Pay referrer their per-cycle bonus
  INSERT INTO transactions (
    user_id, amount, transaction_type, wallet_type, description, status, metadata
  ) VALUES (
    v_referrer_id,
    _bonus_amount,
    'drop_referral_cycle',
    'earnings',
    'Royalty from your recruit''s machine cycle',
    'completed',
    json_build_object('referee_id', _referee_id)
  );
  
  -- Invalidate referrer's cached balance
  DELETE FROM cached_balances WHERE user_id = v_referrer_id;
END;
$$;

-- UTILITY 2: Pay user profit (either to earnings or deposit for auto-compound)
CREATE OR REPLACE FUNCTION pay_user_profit(
  _user_id UUID,
  _profit_amount NUMERIC,
  _auto_compound BOOLEAN
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _auto_compound THEN
    -- AUTO-COMPOUND: Profit goes to deposit wallet
    INSERT INTO transactions (
      user_id, amount, transaction_type, wallet_type, description, status, metadata
    ) VALUES (
      _user_id,
      _profit_amount,
      'drop_profit',
      'deposit',
      'Auto-compound: Profit added to your empire fund',
      'completed',
      json_build_object('auto_compounded', true)
    );
  ELSE
    -- CASH OUT: Profit goes to earnings wallet (withdrawable)
    INSERT INTO transactions (
      user_id, amount, transaction_type, wallet_type, description, status, metadata
    ) VALUES (
      _user_id,
      _profit_amount,
      'drop_profit',
      'earnings',
      'Machine payout - Ready to withdraw!',
      'completed',
      json_build_object('auto_compounded', false)
    );
  END IF;
  
  -- Invalidate owner's cached balance
  DELETE FROM cached_balances WHERE user_id = _user_id;
END;
$$;

-- UTILITY 3: Pay admin fee to SYSTEM_TREASURY (THE MISSING PIECE!)
CREATE OR REPLACE FUNCTION pay_admin_fee(
  _drop_id UUID,
  _from_user_id UUID,
  _admin_fee NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_from_user_name TEXT;
BEGIN
  IF _admin_fee <= 0 THEN
    RETURN;
  END IF;
  
  -- Get user's name for metadata
  SELECT full_name INTO v_from_user_name FROM profiles WHERE id = _from_user_id;
  
  -- Pay admin fee to SYSTEM_TREASURY
  INSERT INTO transactions (
    user_id, amount, transaction_type, wallet_type, description, status, metadata
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',  -- SYSTEM_TREASURY
    _admin_fee,
    'platform_fee',
    'earnings',
    'Machine yield fee',
    'completed',
    json_build_object(
      'drop_id', _drop_id,
      'admin_fee', _admin_fee,
      'from_user', _from_user_id,
      'from_user_name', v_from_user_name
    )
  );
END;
$$;

-- UTILITY 4: Update spot statistics after a cycle
CREATE OR REPLACE FUNCTION update_spot_stats(
  _spot_id UUID,
  _profit_amount NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE spots 
  SET total_cycles = total_cycles + 1,
      total_earnings = total_earnings + _profit_amount
  WHERE id = _spot_id;
END;
$$;

-- UTILITY 5: Create re-entry drop (machine goes back to end of line)
CREATE OR REPLACE FUNCTION create_reentry_drop(
  _spot_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_position INTEGER;
  v_new_drop_id UUID;
BEGIN
  SELECT get_next_drop_position() INTO v_new_position;
  
  INSERT INTO drops (spot_id, position, status, source_type, is_settled)
  VALUES (_spot_id, v_new_position, 'waiting', 're-entry', false)
  RETURNING id INTO v_new_drop_id;
  
  RETURN v_new_drop_id;
END;
$$;

-- UTILITY 6: Send payout notification
CREATE OR REPLACE FUNCTION send_payout_notification(
  _user_id UUID,
  _profit_amount NUMERIC,
  _auto_compound BOOLEAN
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM create_notification(
    _user_id := _user_id,
    _type := 'drop_payout',
    _title := 'Machine Payout!',
    _message := CASE 
      WHEN _auto_compound THEN
        format('₦%s added to your empire fund. Building your fleet!', _profit_amount)
      ELSE
        format('₦%s profit ready to withdraw!', _profit_amount)
    END
  );
END;
$$;

-- ============================================
-- REFACTORED: Main distribute_liquidity function
-- Now uses utility functions - cleaner and more maintainable
-- ============================================
CREATE OR REPLACE FUNCTION distribute_liquidity(
  _origin_drop_id UUID,
  _amount NUMERIC,
  _max_depth INTEGER DEFAULT 100
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
BEGIN
  -- Get platform config
  SELECT * INTO v_config FROM platform_config WHERE id = 1;
  
  -- Process liquidity distribution
  WHILE v_remaining > 0 AND v_depth < _max_depth LOOP
    v_depth := v_depth + 1;
    
    -- Find the oldest unfilled drop (excluding the origin)
    SELECT d.*, s.user_id as spot_owner_id,
           p.auto_compound_enabled, p.referred_by_code
    INTO v_target_drop
    FROM drops d
    JOIN spots s ON s.id = d.spot_id
    JOIN profiles p ON p.id = s.user_id
    WHERE d.id != _origin_drop_id
      AND d.status IN ('waiting', 'filling')
      AND d.fill_amount < d.target_amount
    ORDER BY d.position ASC
    LIMIT 1;
    
    -- No more drops to fill
    IF v_target_drop IS NULL THEN
      EXIT;
    END IF;
    
    -- Calculate how much this drop needs
    v_amount_to_fill := LEAST(v_remaining, v_target_drop.target_amount - v_target_drop.fill_amount);
    
    -- Update the drop's fill amount
    UPDATE drops 
    SET fill_amount = fill_amount + v_amount_to_fill,
        status = CASE 
          WHEN fill_amount + v_amount_to_fill >= target_amount THEN 'completed'
          ELSE 'filling'
        END,
        completed_at = CASE 
          WHEN fill_amount + v_amount_to_fill >= target_amount THEN now()
          ELSE NULL
        END
    WHERE id = v_target_drop.id;
    
    v_remaining := v_remaining - v_amount_to_fill;
    v_distributed := v_distributed + v_amount_to_fill;
    
    -- Check if this drop is now complete (bucket full at 1500)
    IF v_target_drop.fill_amount + v_amount_to_fill >= v_target_drop.target_amount THEN
      v_payouts_made := v_payouts_made + 1;
      v_spot_owner_id := v_target_drop.spot_owner_id;
      v_should_auto_compound := COALESCE(v_target_drop.auto_compound_enabled, false);
      
      -- ==========================================
      -- STEP 1: Pay referral bonus (if applicable)
      -- ==========================================
      PERFORM pay_referral_bonus(
        v_target_drop.referred_by_code,
        v_spot_owner_id,
        v_config.drop_referral_per_cycle
      );
      
      -- ==========================================
      -- STEP 2: Pay user profit
      -- ==========================================
      PERFORM pay_user_profit(
        v_spot_owner_id,
        v_config.drop_profit_amount,
        v_should_auto_compound
      );
      
      -- ==========================================
      -- STEP 3: Pay admin fee (THE FIX!)
      -- ==========================================
      PERFORM pay_admin_fee(
        v_target_drop.id,
        v_spot_owner_id,
        v_config.drop_admin_fee
      );
      
      -- ==========================================
      -- STEP 4: Update spot statistics
      -- ==========================================
      PERFORM update_spot_stats(
        v_target_drop.spot_id,
        v_config.drop_profit_amount
      );
      
      -- Mark drop as paid
      UPDATE drops 
      SET status = 'paid', paid_at = now()
      WHERE id = v_target_drop.id;
      
      -- ==========================================
      -- STEP 5: Send notification
      -- ==========================================
      PERFORM send_payout_notification(
        v_spot_owner_id,
        v_config.drop_profit_amount,
        v_should_auto_compound
      );
      
      -- ==========================================
      -- STEP 6: Create re-entry drop
      -- ==========================================
      PERFORM create_reentry_drop(v_target_drop.spot_id);
      v_reentries_made := v_reentries_made + 1;
      
      -- Calculate overflow (any extra beyond target)
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
$$;

-- ============================================
-- BACKFILL: Fix position gaps (renumber 20+ to fill 18-19)
-- ============================================
-- Current: 1-17 exist, 18-19 missing, 20-23 exist
-- Fix: Shift 20->18, 21->19, 22->20, 23->21

UPDATE drops SET position = position - 2 WHERE position >= 20;

-- ============================================
-- BACKFILL: Add missing platform fees for positions 11 and 12
-- ============================================

-- Position 11: Chiemerie David okeke (drop_id: ae953af7-ee39-40ed-a8e0-6f3d65c87ef7)
INSERT INTO transactions (user_id, amount, wallet_type, transaction_type, description, status, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  100,
  'earnings',
  'platform_fee',
  'Machine yield fee (backfill)',
  'completed',
  '{"drop_id": "ae953af7-ee39-40ed-a8e0-6f3d65c87ef7", "admin_fee": 100, "from_user": "8e46e5a3-e4a5-4e44-a0d6-7feaffa61c76", "backfill": true}'::json
);

-- Position 12: Samuel Nnadozie (drop_id: 05b2aae9-3112-4f48-b9e3-793949e88d59)
INSERT INTO transactions (user_id, amount, wallet_type, transaction_type, description, status, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  100,
  'earnings',
  'platform_fee',
  'Machine yield fee (backfill)',
  'completed',
  '{"drop_id": "05b2aae9-3112-4f48-b9e3-793949e88d59", "admin_fee": 100, "from_user": "836c1d66-1053-45d4-ac4c-a5d76ba58f90", "backfill": true}'::json
);
