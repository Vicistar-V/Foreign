-- Add genesis tracking columns to spots table
ALTER TABLE spots 
ADD COLUMN is_genesis_spot BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN genesis_yields_remaining INTEGER NOT NULL DEFAULT 0;

-- Migrate existing data: mark each user's first spot as genesis spot
-- and copy their genesis_yields_remaining from profiles
WITH first_spots AS (
  SELECT DISTINCT ON (user_id) 
    s.id as spot_id,
    s.user_id,
    COALESCE(p.genesis_yields_remaining, 0) as genesis_remaining
  FROM spots s
  JOIN profiles p ON p.id = s.user_id
  ORDER BY user_id, s.created_at ASC
)
UPDATE spots s
SET 
  is_genesis_spot = true,
  genesis_yields_remaining = fs.genesis_remaining
FROM first_spots fs
WHERE s.id = fs.spot_id;

-- Drop genesis_yields_remaining from profiles (no longer needed)
ALTER TABLE profiles DROP COLUMN genesis_yields_remaining;

-- Update create_spot function to set genesis only for first spot
CREATE OR REPLACE FUNCTION create_spot(
  _user_id UUID,
  _source_wallet wallet_type DEFAULT 'deposit'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config RECORD;
  v_balance NUMERIC;
  v_spot_id UUID;
  v_drop_id UUID;
  v_position INTEGER;
  v_spot_count INTEGER;
  v_is_genesis BOOLEAN;
  v_genesis_yields INTEGER;
  v_spot_name TEXT;
BEGIN
  -- Get platform config
  SELECT * INTO v_config FROM platform_config WHERE id = 1;
  
  -- Check if drop system is active
  IF NOT v_config.drop_system_active THEN
    RETURN json_build_object('success', false, 'error', 'The Viketa Line is currently paused');
  END IF;
  
  -- Check balance in source wallet
  SELECT check_balance(_user_id, _source_wallet) INTO v_balance;
  
  IF v_balance < v_config.drop_entry_fee THEN
    RETURN json_build_object(
      'success', false, 
      'error', format('Not enough money in your %s wallet. You need ₦%s but have ₦%s', 
        _source_wallet, v_config.drop_entry_fee, v_balance)
    );
  END IF;
  
  -- Count existing spots for this user
  SELECT COUNT(*) INTO v_spot_count FROM spots WHERE user_id = _user_id AND status = 'active';
  
  -- Determine if this is a genesis spot (first spot only)
  IF v_spot_count = 0 THEN
    v_is_genesis := true;
    v_genesis_yields := 3;
    v_spot_name := 'Machine 1';
  ELSE
    v_is_genesis := false;
    v_genesis_yields := 0;
    v_spot_name := format('Machine %s', v_spot_count + 1);
  END IF;
  
  -- Deduct entry fee from source wallet
  INSERT INTO transactions (
    user_id,
    amount,
    transaction_type,
    wallet_type,
    description,
    status
  ) VALUES (
    _user_id,
    -v_config.drop_entry_fee,
    'drop_entry',
    _source_wallet,
    format('Bought %s - joined The Viketa Line', v_spot_name),
    'completed'
  );
  
  -- Invalidate cached balance
  DELETE FROM cached_balances WHERE user_id = _user_id;
  
  -- Create the spot with genesis info
  INSERT INTO spots (user_id, spot_name, status, is_genesis_spot, genesis_yields_remaining)
  VALUES (_user_id, v_spot_name, 'active', v_is_genesis, v_genesis_yields)
  RETURNING id INTO v_spot_id;
  
  -- Get next position in line
  SELECT get_next_drop_position() INTO v_position;
  
  -- Create the drop entry
  INSERT INTO drops (spot_id, position, status, source_type, is_settled)
  VALUES (v_spot_id, v_position, 'waiting', 'new', false)
  RETURNING id INTO v_drop_id;
  
  -- Create notification for user
  PERFORM create_notification(
    _user_id := _user_id,
    _type := 'spot_created',
    _title := format('%s is now active!', v_spot_name),
    _message := format('You are now Position #%s in The Viketa Line. When 2 people join after you, you earn!', v_position)
  );
  
  RETURN json_build_object(
    'success', true,
    'spot_id', v_spot_id,
    'drop_id', v_drop_id,
    'position', v_position,
    'spot_name', v_spot_name,
    'is_genesis_spot', v_is_genesis,
    'genesis_yields_remaining', v_genesis_yields
  );
END;
$$;

-- Update distribute_liquidity to check spot's genesis, not profile's
CREATE OR REPLACE FUNCTION distribute_liquidity(
  _origin_drop_id UUID,
  _amount NUMERIC,
  _max_depth INTEGER DEFAULT 100
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  v_new_drop_id UUID;
  v_new_position INTEGER;
  v_referrer_id UUID;
  v_should_auto_compound BOOLEAN;
  v_genesis_remaining INTEGER;
  v_is_genesis_spot BOOLEAN;
  v_user_auto_compound BOOLEAN;
BEGIN
  -- Get platform config
  SELECT * INTO v_config FROM platform_config WHERE id = 1;
  
  -- Process liquidity distribution
  WHILE v_remaining > 0 AND v_depth < _max_depth LOOP
    v_depth := v_depth + 1;
    
    -- Find the oldest unfilled drop (excluding the origin)
    SELECT d.*, s.user_id as spot_owner_id, s.is_genesis_spot, s.genesis_yields_remaining,
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
    
    -- Check if this drop is now complete (bucket full)
    IF v_target_drop.fill_amount + v_amount_to_fill >= v_target_drop.target_amount THEN
      v_payouts_made := v_payouts_made + 1;
      
      -- Get spot owner info
      v_spot_owner_id := v_target_drop.spot_owner_id;
      v_is_genesis_spot := v_target_drop.is_genesis_spot;
      v_genesis_remaining := v_target_drop.genesis_yields_remaining;
      v_user_auto_compound := v_target_drop.auto_compound_enabled;
      
      -- Determine if we should auto-compound
      -- Genesis spot with remaining yields = FORCED auto-compound
      IF v_is_genesis_spot AND v_genesis_remaining > 0 THEN
        v_should_auto_compound := true;
        
        -- Decrement genesis counter on the SPOT
        UPDATE spots 
        SET genesis_yields_remaining = genesis_yields_remaining - 1
        WHERE id = v_target_drop.spot_id;
        
        v_genesis_remaining := v_genesis_remaining - 1;
      ELSE
        -- Non-genesis or genesis complete: respect user's toggle
        v_should_auto_compound := v_user_auto_compound;
      END IF;
      
      -- Pay referral bonus (always, regardless of genesis)
      IF v_target_drop.referred_by_code IS NOT NULL AND v_config.drop_referral_per_cycle > 0 THEN
        SELECT id INTO v_referrer_id 
        FROM profiles 
        WHERE referral_code = v_target_drop.referred_by_code;
        
        IF v_referrer_id IS NOT NULL THEN
          -- Pay referrer their per-cycle bonus (from admin fee)
          INSERT INTO transactions (
            user_id, amount, transaction_type, wallet_type, description, status
          ) VALUES (
            v_referrer_id,
            v_config.drop_referral_per_cycle,
            'drop_referral_cycle',
            'earnings',
            format('Royalty from your recruit''s machine cycle'),
            'completed'
          );
          
          -- Invalidate referrer's cached balance
          DELETE FROM cached_balances WHERE user_id = v_referrer_id;
        END IF;
      END IF;
      
      -- Handle profit based on auto-compound setting
      IF v_should_auto_compound THEN
        -- AUTO-COMPOUND: Profit goes to deposit wallet for buying more spots
        INSERT INTO transactions (
          user_id, amount, transaction_type, wallet_type, description, status,
          metadata
        ) VALUES (
          v_spot_owner_id,
          v_config.drop_profit_amount,
          'drop_profit',
          'deposit',
          CASE 
            WHEN v_is_genesis_spot AND v_genesis_remaining >= 0 THEN
              format('Genesis Yield %s/3 - Building your fleet!', 3 - v_genesis_remaining)
            ELSE
              'Auto-compound: Profit added to your empire fund'
          END,
          'completed',
          json_build_object('auto_compounded', true, 'genesis_yield', v_is_genesis_spot AND v_genesis_remaining >= 0)
        );
      ELSE
        -- CASH OUT: Profit goes to earnings wallet (withdrawable)
        INSERT INTO transactions (
          user_id, amount, transaction_type, wallet_type, description, status,
          metadata
        ) VALUES (
          v_spot_owner_id,
          v_config.drop_profit_amount,
          'drop_profit',
          'earnings',
          'Machine payout - Ready to withdraw!',
          'completed',
          json_build_object('auto_compounded', false)
        );
      END IF;
      
      -- Invalidate owner's cached balance
      DELETE FROM cached_balances WHERE user_id = v_spot_owner_id;
      
      -- Update spot stats
      UPDATE spots 
      SET total_cycles = total_cycles + 1,
          total_earnings = total_earnings + v_config.drop_profit_amount
      WHERE id = v_target_drop.spot_id;
      
      -- Mark drop as paid
      UPDATE drops 
      SET status = 'paid', paid_at = now()
      WHERE id = v_target_drop.id;
      
      -- Create notification
      PERFORM create_notification(
        _user_id := v_spot_owner_id,
        _type := 'drop_payout',
        _title := CASE 
          WHEN v_is_genesis_spot AND v_genesis_remaining >= 0 THEN
            format('Genesis Yield %s/3 Complete!', 3 - v_genesis_remaining)
          ELSE
            'Machine Payout!'
        END,
        _message := CASE 
          WHEN v_should_auto_compound THEN
            format('₦%s added to your empire fund. Building your fleet!', v_config.drop_profit_amount)
          ELSE
            format('₦%s profit ready to withdraw!', v_config.drop_profit_amount)
        END
      );
      
      -- Create re-entry drop
      v_reentries_made := v_reentries_made + 1;
      
      SELECT get_next_drop_position() INTO v_new_position;
      
      INSERT INTO drops (spot_id, position, status, source_type, is_settled)
      VALUES (v_target_drop.spot_id, v_new_position, 'waiting', 're-entry', false)
      RETURNING id INTO v_new_drop_id;
      
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

-- Update get_user_drops_status to include genesis info from spots
CREATE OR REPLACE FUNCTION get_user_drops_status(_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_genesis_spot RECORD;
BEGIN
  -- Get genesis spot info for this user
  SELECT is_genesis_spot, genesis_yields_remaining
  INTO v_genesis_spot
  FROM spots
  WHERE user_id = _user_id AND is_genesis_spot = true
  LIMIT 1;

  SELECT json_build_object(
    'spots', COALESCE((
      SELECT json_agg(json_build_object(
        'id', s.id,
        'spot_name', s.spot_name,
        'status', s.status,
        'total_cycles', s.total_cycles,
        'total_earnings', s.total_earnings,
        'is_genesis_spot', s.is_genesis_spot,
        'genesis_yields_remaining', s.genesis_yields_remaining,
        'created_at', s.created_at,
        'current_drop', (
          SELECT json_build_object(
            'id', d.id,
            'position', d.position,
            'fill_amount', d.fill_amount,
            'target_amount', d.target_amount,
            'status', d.status,
            'fill_percentage', ROUND((d.fill_amount / d.target_amount) * 100, 1)
          )
          FROM drops d
          WHERE d.spot_id = s.id AND d.status IN ('waiting', 'filling')
          ORDER BY d.created_at DESC
          LIMIT 1
        )
      ) ORDER BY s.created_at ASC)
      FROM spots s
      WHERE s.user_id = _user_id AND s.status = 'active'
    ), '[]'::json),
    'genesis_yields_remaining', COALESCE(v_genesis_spot.genesis_yields_remaining, 0),
    'has_genesis_spot', COALESCE(v_genesis_spot.is_genesis_spot, false)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;