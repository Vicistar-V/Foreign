-- =====================================================
-- VIKETA CYCLER SYSTEM - HYPER-SPEED 1:2 ENGINE
-- =====================================================
-- This migration creates the complete cycler infrastructure:
-- 1. New tables: cycle_positions, cycle_transactions
-- 2. Platform config updates for cycler settings
-- 3. Profile updates for referral commission tracking
-- 4. Core functions: join_cycle_queue, distribute_cycle_funds, process_cycle_payout
-- =====================================================

-- =====================================================
-- STEP 1: ADD NEW COLUMNS TO platform_config
-- =====================================================
ALTER TABLE platform_config 
ADD COLUMN IF NOT EXISTS cycler_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cycler_entry_fee NUMERIC DEFAULT 1000,
ADD COLUMN IF NOT EXISTS cycler_payout_target NUMERIC DEFAULT 2000,
ADD COLUMN IF NOT EXISTS cycler_admin_fee NUMERIC DEFAULT 100,
ADD COLUMN IF NOT EXISTS cycler_auto_reentry_amount NUMERIC DEFAULT 1000,
ADD COLUMN IF NOT EXISTS cycler_user_profit NUMERIC DEFAULT 900,
ADD COLUMN IF NOT EXISTS cycler_referral_bonus NUMERIC DEFAULT 500,
ADD COLUMN IF NOT EXISTS referral_payout_trigger TEXT DEFAULT 'ON_ACTIVATION';

-- =====================================================
-- STEP 2: ADD referral_commission_paid TO profiles
-- =====================================================
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS referral_commission_paid BOOLEAN DEFAULT false;

-- =====================================================
-- STEP 3: CREATE cycle_positions TABLE (The Queue)
-- =====================================================
CREATE TABLE IF NOT EXISTS cycle_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_number SERIAL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_paid NUMERIC NOT NULL DEFAULT 1000,
  filled_amount NUMERIC NOT NULL DEFAULT 0,
  target_amount NUMERIC NOT NULL DEFAULT 2000,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'REFUNDED')),
  cycle_number INTEGER NOT NULL DEFAULT 1,
  is_auto_reentry BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for fast queue lookups
CREATE INDEX IF NOT EXISTS idx_cycle_positions_status ON cycle_positions(status);
CREATE INDEX IF NOT EXISTS idx_cycle_positions_user ON cycle_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_cycle_positions_queue ON cycle_positions(status, position_number) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_cycle_positions_created ON cycle_positions(created_at);

-- Enable RLS
ALTER TABLE cycle_positions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cycle_positions
CREATE POLICY "Users can view their own positions" ON cycle_positions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all positions" ON cycle_positions
  FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- STEP 4: CREATE cycle_transactions TABLE (Ledger)
-- =====================================================
CREATE TABLE IF NOT EXISTS cycle_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_position_id UUID REFERENCES cycle_positions(id) ON DELETE SET NULL,
  dest_position_id UUID REFERENCES cycle_positions(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  transaction_type TEXT NOT NULL DEFAULT 'fill' CHECK (transaction_type IN ('fill', 'payout', 'reentry', 'refund', 'fee', 'referral')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

-- Indexes for ledger lookups
CREATE INDEX IF NOT EXISTS idx_cycle_transactions_source ON cycle_transactions(source_position_id);
CREATE INDEX IF NOT EXISTS idx_cycle_transactions_dest ON cycle_transactions(dest_position_id);
CREATE INDEX IF NOT EXISTS idx_cycle_transactions_type ON cycle_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_cycle_transactions_created ON cycle_transactions(created_at);

-- Enable RLS
ALTER TABLE cycle_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cycle_transactions
CREATE POLICY "Users can view transactions for their positions" ON cycle_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cycle_positions 
      WHERE (cycle_positions.id = source_position_id OR cycle_positions.id = dest_position_id)
      AND cycle_positions.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all transactions" ON cycle_transactions
  FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- STEP 5: ADD new transaction types for cycler
-- =====================================================
-- First check if they exist, then add
DO $$ 
BEGIN
  -- Add cycle_entry if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'cycle_entry' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'transaction_type')) THEN
    ALTER TYPE transaction_type ADD VALUE 'cycle_entry';
  END IF;
  
  -- Add cycle_payout if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'cycle_payout' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'transaction_type')) THEN
    ALTER TYPE transaction_type ADD VALUE 'cycle_payout';
  END IF;
  
  -- Add cycle_reentry if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'cycle_reentry' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'transaction_type')) THEN
    ALTER TYPE transaction_type ADD VALUE 'cycle_reentry';
  END IF;
  
  -- Add cycle_referral if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'cycle_referral' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'transaction_type')) THEN
    ALTER TYPE transaction_type ADD VALUE 'cycle_referral';
  END IF;
END $$;

-- =====================================================
-- STEP 6: CREATE get_cycle_queue_stats FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION get_cycle_queue_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total_pending INTEGER;
  _total_paid INTEGER;
  _oldest_pending_id UUID;
  _oldest_pending_position INTEGER;
  _oldest_pending_filled NUMERIC;
  _oldest_pending_target NUMERIC;
  _avg_wait_seconds NUMERIC;
  _last_payout TIMESTAMPTZ;
  _payouts_last_hour INTEGER;
BEGIN
  -- Count pending positions
  SELECT COUNT(*) INTO _total_pending
  FROM cycle_positions WHERE status = 'PENDING';
  
  -- Count paid positions
  SELECT COUNT(*) INTO _total_paid
  FROM cycle_positions WHERE status = 'PAID';
  
  -- Get oldest pending position details
  SELECT id, position_number, filled_amount, target_amount
  INTO _oldest_pending_id, _oldest_pending_position, _oldest_pending_filled, _oldest_pending_target
  FROM cycle_positions
  WHERE status = 'PENDING'
  ORDER BY position_number ASC
  LIMIT 1;
  
  -- Calculate average wait time (from paid positions in last 24 hours)
  SELECT AVG(EXTRACT(EPOCH FROM (paid_at - created_at)))
  INTO _avg_wait_seconds
  FROM cycle_positions
  WHERE status = 'PAID' AND paid_at > now() - interval '24 hours';
  
  -- Get last payout time
  SELECT MAX(paid_at) INTO _last_payout
  FROM cycle_positions WHERE status = 'PAID';
  
  -- Count payouts in last hour
  SELECT COUNT(*) INTO _payouts_last_hour
  FROM cycle_positions
  WHERE status = 'PAID' AND paid_at > now() - interval '1 hour';
  
  RETURN jsonb_build_object(
    'total_pending', COALESCE(_total_pending, 0),
    'total_paid', COALESCE(_total_paid, 0),
    'oldest_pending', CASE WHEN _oldest_pending_id IS NOT NULL THEN
      jsonb_build_object(
        'id', _oldest_pending_id,
        'position_number', _oldest_pending_position,
        'filled_amount', _oldest_pending_filled,
        'target_amount', _oldest_pending_target,
        'fill_percentage', ROUND((_oldest_pending_filled / _oldest_pending_target) * 100, 1)
      )
    ELSE NULL END,
    'avg_wait_seconds', ROUND(COALESCE(_avg_wait_seconds, 0)),
    'last_payout', _last_payout,
    'payouts_last_hour', COALESCE(_payouts_last_hour, 0),
    'velocity', CASE WHEN _payouts_last_hour > 0 THEN 'HIGH' WHEN _total_pending > 0 THEN 'NORMAL' ELSE 'IDLE' END
  );
END;
$$;

-- =====================================================
-- STEP 7: CREATE join_cycle_queue FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION join_cycle_queue(
  _user_id UUID,
  _is_auto_reentry BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _config RECORD;
  _entry_fee NUMERIC;
  _target_amount NUMERIC;
  _balances RECORD;
  _credits_to_use NUMERIC;
  _deposit_to_use NUMERIC;
  _new_position_id UUID;
  _new_position_number INTEGER;
  _cycle_number INTEGER;
  _contribution_per_entry NUMERIC;
  _distribution_result JSONB;
BEGIN
  -- Get cycler config
  SELECT cycler_enabled, cycler_entry_fee, cycler_payout_target, cycler_admin_fee
  INTO _config
  FROM platform_config WHERE id = 1;
  
  IF NOT _config.cycler_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'The Viketa Line is not active right now', 'error_code', 'CYCLER_DISABLED');
  END IF;
  
  _entry_fee := _config.cycler_entry_fee;
  _target_amount := _config.cycler_payout_target;
  
  -- Calculate contribution per entry (entry_fee minus admin fee split)
  -- Admin fee is taken from the payout, not the entry
  -- So the full entry goes toward filling buckets
  _contribution_per_entry := _entry_fee - _config.cycler_admin_fee;
  
  -- Get user balances
  SELECT credits_balance, deposit_balance, earnings_balance
  INTO _balances
  FROM user_balances
  WHERE user_id = _user_id
  FOR UPDATE;
  
  IF _balances IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account not found', 'error_code', 'NO_ACCOUNT');
  END IF;
  
  -- Check for negative balances (debt)
  IF _balances.earnings_balance < 0 OR _balances.deposit_balance < 0 OR _balances.credits_balance < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Please clear your debt first', 'error_code', 'HAS_DEBT');
  END IF;
  
  -- Check total available (credits + deposit only, never auto-debit earnings)
  IF (_balances.credits_balance + _balances.deposit_balance) < _entry_fee THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'You need ₦' || _entry_fee || ' to join the line', 
      'error_code', 'INSUFFICIENT_FUNDS',
      'required', _entry_fee,
      'available', _balances.credits_balance + _balances.deposit_balance
    );
  END IF;
  
  -- Calculate waterfall: credits first, then deposit
  IF _balances.credits_balance >= _entry_fee THEN
    _credits_to_use := _entry_fee;
    _deposit_to_use := 0;
  ELSE
    _credits_to_use := _balances.credits_balance;
    _deposit_to_use := _entry_fee - _credits_to_use;
  END IF;
  
  -- Debit the wallets
  UPDATE user_balances
  SET 
    credits_balance = credits_balance - _credits_to_use,
    deposit_balance = deposit_balance - _deposit_to_use,
    last_updated = now()
  WHERE user_id = _user_id;
  
  -- Record the transaction
  INSERT INTO transactions (user_id, transaction_type, wallet_type, amount, description, status)
  VALUES (
    _user_id, 
    'cycle_entry'::transaction_type, 
    CASE WHEN _credits_to_use > 0 THEN 'credits'::wallet_type ELSE 'deposit'::wallet_type END,
    -_entry_fee,
    CASE WHEN _is_auto_reentry THEN 'Auto-joined The Viketa Line' ELSE 'Joined The Viketa Line' END,
    'completed'
  );
  
  -- Get the user's cycle number (how many times they've entered)
  SELECT COALESCE(MAX(cycle_number), 0) + 1 INTO _cycle_number
  FROM cycle_positions
  WHERE user_id = _user_id;
  
  -- Create the new position
  INSERT INTO cycle_positions (user_id, amount_paid, target_amount, cycle_number, is_auto_reentry, metadata)
  VALUES (_user_id, _entry_fee, _target_amount, _cycle_number, _is_auto_reentry, 
    jsonb_build_object(
      'credits_used', _credits_to_use,
      'deposit_used', _deposit_to_use,
      'joined_at', now()
    )
  )
  RETURNING id, position_number INTO _new_position_id, _new_position_number;
  
  -- Distribute the funds to people waiting
  SELECT distribute_cycle_funds(_contribution_per_entry, _new_position_id) INTO _distribution_result;
  
  -- Return success with position info
  RETURN jsonb_build_object(
    'success', true,
    'position_id', _new_position_id,
    'position_number', _new_position_number,
    'cycle_number', _cycle_number,
    'is_auto_reentry', _is_auto_reentry,
    'entry_fee', _entry_fee,
    'target_amount', _target_amount,
    'distribution', _distribution_result
  );
END;
$$;

-- =====================================================
-- STEP 8: CREATE distribute_cycle_funds FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION distribute_cycle_funds(
  _amount NUMERIC,
  _source_position_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _remaining NUMERIC := _amount;
  _cursor RECORD;
  _amount_to_fill NUMERIC;
  _positions_filled INTEGER := 0;
  _total_distributed NUMERIC := 0;
BEGIN
  -- Loop through pending positions from oldest to newest
  FOR _cursor IN 
    SELECT id, user_id, filled_amount, target_amount, cycle_number
    FROM cycle_positions
    WHERE status = 'PENDING'
    AND id != _source_position_id  -- Don't fill yourself
    ORDER BY position_number ASC
  LOOP
    EXIT WHEN _remaining <= 0;
    
    -- Calculate how much this position needs
    _amount_to_fill := LEAST(_remaining, _cursor.target_amount - _cursor.filled_amount);
    
    IF _amount_to_fill > 0 THEN
      -- Update the position's filled amount
      UPDATE cycle_positions
      SET filled_amount = filled_amount + _amount_to_fill
      WHERE id = _cursor.id;
      
      -- Record the transaction
      INSERT INTO cycle_transactions (source_position_id, dest_position_id, amount, transaction_type)
      VALUES (_source_position_id, _cursor.id, _amount_to_fill, 'fill');
      
      _remaining := _remaining - _amount_to_fill;
      _total_distributed := _total_distributed + _amount_to_fill;
      
      -- Check if this position is now full
      IF (_cursor.filled_amount + _amount_to_fill) >= _cursor.target_amount THEN
        -- Process the payout!
        PERFORM process_cycle_payout(_cursor.id);
        _positions_filled := _positions_filled + 1;
      END IF;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'distributed', _total_distributed,
    'remaining', _remaining,
    'positions_filled', _positions_filled
  );
END;
$$;

-- =====================================================
-- STEP 9: CREATE process_cycle_payout FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION process_cycle_payout(_position_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _position RECORD;
  _config RECORD;
  _profile RECORD;
  _referrer RECORD;
  _user_profit NUMERIC;
  _admin_fee NUMERIC;
  _reentry_amount NUMERIC;
  _referral_bonus NUMERIC;
  _new_position_id UUID;
  _new_position_number INTEGER;
BEGIN
  -- Get the position
  SELECT * INTO _position
  FROM cycle_positions
  WHERE id = _position_id
  FOR UPDATE;
  
  IF _position IS NULL OR _position.status != 'PENDING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Position not found or already processed');
  END IF;
  
  -- Get config
  SELECT cycler_admin_fee, cycler_auto_reentry_amount, cycler_user_profit, cycler_referral_bonus, referral_payout_trigger
  INTO _config
  FROM platform_config WHERE id = 1;
  
  _admin_fee := _config.cycler_admin_fee;
  _reentry_amount := _config.cycler_auto_reentry_amount;
  _user_profit := _config.cycler_user_profit;
  _referral_bonus := _config.cycler_referral_bonus;
  
  -- Mark position as paid
  UPDATE cycle_positions
  SET status = 'PAID', paid_at = now()
  WHERE id = _position_id;
  
  -- Credit user profit to earnings
  UPDATE user_balances
  SET earnings_balance = earnings_balance + _user_profit, last_updated = now()
  WHERE user_id = _position.user_id;
  
  -- Record profit transaction
  INSERT INTO transactions (user_id, transaction_type, wallet_type, amount, description, status, metadata)
  VALUES (
    _position.user_id,
    'cycle_payout'::transaction_type,
    'earnings'::wallet_type,
    _user_profit,
    'Cycle ' || _position.cycle_number || ' profit',
    'completed',
    jsonb_build_object('position_id', _position_id, 'cycle_number', _position.cycle_number)
  );
  
  -- Record payout transaction in cycle_transactions
  INSERT INTO cycle_transactions (dest_position_id, amount, transaction_type, metadata)
  VALUES (_position_id, _user_profit, 'payout', jsonb_build_object('type', 'user_profit'));
  
  -- Credit admin fee to system treasury
  UPDATE user_balances
  SET earnings_balance = earnings_balance + _admin_fee, last_updated = now()
  WHERE user_id = '00000000-0000-0000-0000-000000000000';
  
  -- Record admin fee transaction
  INSERT INTO transactions (user_id, transaction_type, wallet_type, amount, description, status, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    'platform_fee'::transaction_type,
    'earnings'::wallet_type,
    _admin_fee,
    'Cycle fee from position #' || _position.position_number,
    'completed',
    jsonb_build_object('position_id', _position_id)
  );
  
  INSERT INTO cycle_transactions (dest_position_id, amount, transaction_type, metadata)
  VALUES (_position_id, _admin_fee, 'fee', jsonb_build_object('type', 'admin_fee'));
  
  -- Handle referral bonus (only on FIRST cycle if trigger is ON_FIRST_CYCLE)
  IF _position.cycle_number = 1 AND _config.referral_payout_trigger = 'ON_FIRST_CYCLE' THEN
    -- Get user profile to check referrer
    SELECT referred_by_code, referral_commission_paid INTO _profile
    FROM profiles WHERE id = _position.user_id;
    
    IF _profile.referred_by_code IS NOT NULL AND NOT COALESCE(_profile.referral_commission_paid, false) THEN
      -- Find the referrer
      SELECT id INTO _referrer
      FROM profiles WHERE referral_code = _profile.referred_by_code;
      
      IF _referrer.id IS NOT NULL THEN
        -- Pay referral bonus
        UPDATE user_balances
        SET earnings_balance = earnings_balance + _referral_bonus, last_updated = now()
        WHERE user_id = _referrer.id;
        
        -- Record referral transaction
        INSERT INTO transactions (user_id, transaction_type, wallet_type, amount, description, status, metadata)
        VALUES (
          _referrer.id,
          'cycle_referral'::transaction_type,
          'earnings'::wallet_type,
          _referral_bonus,
          'Referral bonus - friend completed first cycle',
          'completed',
          jsonb_build_object('referred_user_id', _position.user_id, 'position_id', _position_id)
        );
        
        -- Mark commission as paid
        UPDATE profiles SET referral_commission_paid = true WHERE id = _position.user_id;
        
        INSERT INTO cycle_transactions (source_position_id, amount, transaction_type, metadata)
        VALUES (_position_id, _referral_bonus, 'referral', jsonb_build_object('referrer_id', _referrer.id));
      END IF;
    END IF;
  END IF;
  
  -- Auto re-entry: Create new position for the user
  INSERT INTO cycle_positions (
    user_id, 
    amount_paid, 
    target_amount, 
    cycle_number, 
    is_auto_reentry,
    metadata
  )
  SELECT 
    _position.user_id,
    _reentry_amount,
    (SELECT cycler_payout_target FROM platform_config WHERE id = 1),
    _position.cycle_number + 1,
    true,
    jsonb_build_object('from_position', _position_id, 'auto_reentry', true)
  RETURNING id, position_number INTO _new_position_id, _new_position_number;
  
  -- Record reentry transaction
  INSERT INTO cycle_transactions (source_position_id, dest_position_id, amount, transaction_type, metadata)
  VALUES (_position_id, _new_position_id, _reentry_amount, 'reentry', jsonb_build_object('type', 'auto_reentry'));
  
  -- Queue notification for the user
  INSERT INTO event_queue (user_id, event_type, event_data, status)
  VALUES (
    _position.user_id,
    'winner_alert',
    jsonb_build_object(
      'type', 'cycle_payout',
      'profit', _user_profit,
      'cycle_number', _position.cycle_number,
      'new_position', _new_position_number,
      'message', 'Cycle complete! You earned ₦' || _user_profit || ' and you''re back in line at #' || _new_position_number
    ),
    'pending'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'user_profit', _user_profit,
    'admin_fee', _admin_fee,
    'new_position_id', _new_position_id,
    'new_position_number', _new_position_number,
    'next_cycle', _position.cycle_number + 1
  );
END;
$$;

-- =====================================================
-- STEP 10: CREATE get_user_cycle_positions FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_cycle_positions(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _active_position RECORD;
  _total_profit NUMERIC;
  _total_cycles INTEGER;
  _history JSONB;
BEGIN
  -- Get active (pending) position
  SELECT * INTO _active_position
  FROM cycle_positions
  WHERE user_id = _user_id AND status = 'PENDING'
  ORDER BY position_number DESC
  LIMIT 1;
  
  -- Calculate totals
  SELECT 
    COALESCE(SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END), 0),
    (SELECT cycler_user_profit FROM platform_config WHERE id = 1) * COALESCE(SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END), 0)
  INTO _total_cycles, _total_profit
  FROM cycle_positions
  WHERE user_id = _user_id;
  
  -- Get recent history
  SELECT COALESCE(jsonb_agg(row_to_json(h)), '[]'::jsonb)
  INTO _history
  FROM (
    SELECT 
      id,
      position_number,
      cycle_number,
      status,
      filled_amount,
      target_amount,
      created_at,
      paid_at,
      is_auto_reentry
    FROM cycle_positions
    WHERE user_id = _user_id
    ORDER BY created_at DESC
    LIMIT 10
  ) h;
  
  RETURN jsonb_build_object(
    'active_position', CASE WHEN _active_position IS NOT NULL THEN
      jsonb_build_object(
        'id', _active_position.id,
        'position_number', _active_position.position_number,
        'cycle_number', _active_position.cycle_number,
        'filled_amount', _active_position.filled_amount,
        'target_amount', _active_position.target_amount,
        'fill_percentage', ROUND((_active_position.filled_amount / _active_position.target_amount) * 100, 1),
        'is_auto_reentry', _active_position.is_auto_reentry,
        'created_at', _active_position.created_at
      )
    ELSE NULL END,
    'total_cycles', _total_cycles,
    'total_profit', _total_profit,
    'history', _history
  );
END;
$$;

-- =====================================================
-- STEP 11: Grant permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION get_cycle_queue_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_cycle_queue_stats TO service_role;
GRANT EXECUTE ON FUNCTION join_cycle_queue TO service_role;
GRANT EXECUTE ON FUNCTION distribute_cycle_funds TO service_role;
GRANT EXECUTE ON FUNCTION process_cycle_payout TO service_role;
GRANT EXECUTE ON FUNCTION get_user_cycle_positions TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_cycle_positions TO service_role;

-- Enable realtime for cycle_positions (for live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE cycle_positions;
ALTER TABLE cycle_positions REPLICA IDENTITY FULL;