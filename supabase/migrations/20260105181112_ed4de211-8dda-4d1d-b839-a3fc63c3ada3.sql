-- =====================================================
-- VIKETA DROP SYSTEM - DATABASE FOUNDATION
-- =====================================================

-- 1. Add new transaction types for the drop system
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'drop_entry';
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'drop_profit';
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'drop_reentry';
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'drop_referral_cycle';

-- 2. Add drop system columns to platform_config
ALTER TABLE public.platform_config 
ADD COLUMN IF NOT EXISTS drop_entry_fee DECIMAL(12,2) NOT NULL DEFAULT 1000,
ADD COLUMN IF NOT EXISTS drop_target_amount DECIMAL(12,2) NOT NULL DEFAULT 1500,
ADD COLUMN IF NOT EXISTS drop_profit_amount DECIMAL(12,2) NOT NULL DEFAULT 400,
ADD COLUMN IF NOT EXISTS drop_admin_fee DECIMAL(12,2) NOT NULL DEFAULT 100,
ADD COLUMN IF NOT EXISTS drop_reentry_amount DECIMAL(12,2) NOT NULL DEFAULT 1000,
ADD COLUMN IF NOT EXISTS drop_referral_per_cycle DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS drop_pulse_interval_seconds INTEGER NOT NULL DEFAULT 60,
ADD COLUMN IF NOT EXISTS drop_system_active BOOLEAN NOT NULL DEFAULT true;

-- 3. Create spots table (The User's Machine/Permit)
CREATE TABLE public.spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  spot_name TEXT NOT NULL DEFAULT 'Spot 1',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_cycles INTEGER NOT NULL DEFAULT 0,
  total_earnings DECIMAL(12,2) NOT NULL DEFAULT 0
);

-- 4. Create drops table (The Live Queue Entry)
CREATE TABLE public.drops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id UUID NOT NULL REFERENCES public.spots(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  fill_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  target_amount DECIMAL(12,2) NOT NULL DEFAULT 1500,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'filling', 'completed', 'paid', 're-entered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  source_type TEXT NOT NULL DEFAULT 'new' CHECK (source_type IN ('new', 're-entry')),
  is_settled BOOLEAN NOT NULL DEFAULT false
);

-- 5. Create drop_pulses table (The Heartbeat Log)
CREATE TABLE public.drop_pulses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pulse_number INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  new_drops_processed INTEGER DEFAULT 0,
  re_entries_processed INTEGER DEFAULT 0,
  payouts_made INTEGER DEFAULT 0,
  total_distributed DECIMAL(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed'))
);

-- 6. Create indexes for performance
CREATE INDEX idx_spots_user_id ON public.spots(user_id);
CREATE INDEX idx_spots_status ON public.spots(status);
CREATE INDEX idx_drops_spot_id ON public.drops(spot_id);
CREATE INDEX idx_drops_position ON public.drops(position);
CREATE INDEX idx_drops_status ON public.drops(status);
CREATE INDEX idx_drops_is_settled ON public.drops(is_settled);
CREATE INDEX idx_drops_created_at ON public.drops(created_at);
CREATE INDEX idx_drop_pulses_started_at ON public.drop_pulses(started_at);

-- 7. Enable RLS on new tables
ALTER TABLE public.spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drop_pulses ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies for spots table
CREATE POLICY "Users can view their own spots"
ON public.spots FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all spots"
ON public.spots FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view all spots"
ON public.spots FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 9. RLS Policies for drops table
CREATE POLICY "Users can view drops for their spots"
ON public.drops FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.spots 
  WHERE spots.id = drops.spot_id 
  AND spots.user_id = auth.uid()
));

CREATE POLICY "Service role can manage all drops"
ON public.drops FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view all drops"
ON public.drops FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view drop positions for transparency"
ON public.drops FOR SELECT
USING (true);

-- 10. RLS Policies for drop_pulses table
CREATE POLICY "Admins can view pulse history"
ON public.drop_pulses FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage pulses"
ON public.drop_pulses FOR ALL
USING (auth.role() = 'service_role');

-- 11. Create sequence for drop positions
CREATE SEQUENCE IF NOT EXISTS public.drop_position_seq START 1;

-- 12. Function to get next drop position
CREATE OR REPLACE FUNCTION public.get_next_drop_position()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(MAX(position), 0) + 1 FROM public.drops;
$$;

-- 13. Function to create a new spot (The "Buy Machine" function)
CREATE OR REPLACE FUNCTION public.create_spot(
  _user_id UUID,
  _source_wallet wallet_type DEFAULT 'deposit'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _balance DECIMAL;
  _config RECORD;
  _spot_id UUID;
  _drop_id UUID;
  _position INTEGER;
  _spot_count INTEGER;
  _spot_name TEXT;
BEGIN
  -- Get platform config
  SELECT drop_entry_fee, drop_target_amount, drop_system_active 
  INTO _config 
  FROM platform_config WHERE id = 1;

  -- Check if drop system is active
  IF NOT _config.drop_system_active THEN
    RETURN json_build_object('success', false, 'error', 'The Viketa Line is currently paused');
  END IF;

  -- Check user's balance in source wallet
  SELECT COALESCE(SUM(amount), 0) INTO _balance
  FROM transactions
  WHERE user_id = _user_id 
    AND wallet_type = _source_wallet 
    AND status = 'completed';

  IF _balance < _config.drop_entry_fee THEN
    RETURN json_build_object(
      'success', false, 
      'error', format('Not enough money. You need ₦%s but have ₦%s', _config.drop_entry_fee, _balance)
    );
  END IF;

  -- Count existing spots for naming
  SELECT COUNT(*) + 1 INTO _spot_count FROM spots WHERE user_id = _user_id;
  _spot_name := 'Spot ' || _spot_count;

  -- Get next position in the queue
  SELECT get_next_drop_position() INTO _position;

  -- Deduct from user's wallet
  INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES (
    _user_id, 
    _source_wallet, 
    -_config.drop_entry_fee, 
    'drop_entry', 
    format('Bought %s - Position #%s in The Line', _spot_name, _position),
    'completed',
    json_build_object('spot_name', _spot_name, 'position', _position)
  );

  -- Credit system treasury
  INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    'earnings',
    _config.drop_entry_fee,
    'drop_entry',
    format('Spot purchase by user - Position #%s', _position),
    'completed',
    json_build_object('buyer_id', _user_id::text, 'position', _position)
  );

  -- Create the spot
  INSERT INTO spots (user_id, spot_name, status)
  VALUES (_user_id, _spot_name, 'active')
  RETURNING id INTO _spot_id;

  -- Create the drop (entry in the queue)
  INSERT INTO drops (spot_id, position, fill_amount, target_amount, status, source_type, is_settled)
  VALUES (_spot_id, _position, 0, _config.drop_target_amount, 'waiting', 'new', false)
  RETURNING id INTO _drop_id;

  -- Create notification
  INSERT INTO notifications (user_id, notification_type, title, message, metadata, link)
  VALUES (
    _user_id,
    'drop_joined',
    'You Joined The Line!',
    format('Your %s is now at Position #%s. Waiting for people to join behind you...', _spot_name, _position),
    json_build_object('spot_id', _spot_id::text, 'position', _position),
    '/dashboard'
  );

  RETURN json_build_object(
    'success', true,
    'spot_id', _spot_id,
    'drop_id', _drop_id,
    'spot_name', _spot_name,
    'position', _position,
    'message', format('You are now Position #%s in The Viketa Line!', _position)
  );
END;
$$;

-- 14. Function to get queue status (transparency)
CREATE OR REPLACE FUNCTION public.get_drop_queue_status()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _total_in_queue INTEGER;
  _next_to_pay INTEGER;
  _total_paid_today INTEGER;
  _total_paid_amount_today DECIMAL;
  _last_payout_at TIMESTAMPTZ;
BEGIN
  -- Total active drops in queue
  SELECT COUNT(*) INTO _total_in_queue
  FROM drops WHERE status IN ('waiting', 'filling');

  -- Next position to be paid (oldest unpaid)
  SELECT MIN(position) INTO _next_to_pay
  FROM drops WHERE status IN ('waiting', 'filling');

  -- Payouts made today
  SELECT COUNT(*), COALESCE(SUM(target_amount - 1000), 0)
  INTO _total_paid_today, _total_paid_amount_today
  FROM drops 
  WHERE status IN ('paid', 're-entered') 
    AND paid_at >= CURRENT_DATE;

  -- Last payout time
  SELECT MAX(paid_at) INTO _last_payout_at
  FROM drops WHERE status IN ('paid', 're-entered');

  RETURN json_build_object(
    'total_in_queue', COALESCE(_total_in_queue, 0),
    'next_position_to_pay', COALESCE(_next_to_pay, 0),
    'paid_today_count', COALESCE(_total_paid_today, 0),
    'paid_today_amount', COALESCE(_total_paid_amount_today, 0),
    'last_payout_at', _last_payout_at
  );
END;
$$;

-- 15. The MAIN Engine: Process Drop Pulse (The 60-second heartbeat)
CREATE OR REPLACE FUNCTION public.process_drop_pulse()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _config RECORD;
  _pulse_id UUID;
  _pulse_number INTEGER;
  _unsettled_drops RECORD;
  _target_drop RECORD;
  _remaining_amount DECIMAL;
  _fill_amount DECIMAL;
  _new_drops_count INTEGER := 0;
  _payouts_count INTEGER := 0;
  _reentries_count INTEGER := 0;
  _total_distributed DECIMAL := 0;
  _new_position INTEGER;
  _spot_owner UUID;
  _new_drop_id UUID;
BEGIN
  -- Get config
  SELECT * INTO _config FROM platform_config WHERE id = 1;

  -- Check if system is active
  IF NOT _config.drop_system_active THEN
    RETURN json_build_object('success', false, 'message', 'Drop system is paused');
  END IF;

  -- Get next pulse number
  SELECT COALESCE(MAX(pulse_number), 0) + 1 INTO _pulse_number FROM drop_pulses;

  -- Create pulse record
  INSERT INTO drop_pulses (pulse_number, status)
  VALUES (_pulse_number, 'running')
  RETURNING id INTO _pulse_id;

  -- Process all unsettled drops (new entries that haven't been distributed yet)
  FOR _unsettled_drops IN 
    SELECT d.id, d.spot_id, d.position, s.user_id
    FROM drops d
    JOIN spots s ON s.id = d.spot_id
    WHERE d.is_settled = false
    ORDER BY d.created_at ASC
  LOOP
    _new_drops_count := _new_drops_count + 1;
    _remaining_amount := _config.drop_entry_fee; -- ₦1,000 to distribute

    -- Mark this drop as settled (we're processing it)
    UPDATE drops SET is_settled = true WHERE id = _unsettled_drops.id;

    -- Distribute to oldest waiting drops (spillover logic)
    WHILE _remaining_amount > 0 LOOP
      -- Find the oldest drop that needs filling
      SELECT d.id, d.spot_id, d.position, d.fill_amount, d.target_amount, s.user_id
      INTO _target_drop
      FROM drops d
      JOIN spots s ON s.id = d.spot_id
      WHERE d.status IN ('waiting', 'filling')
        AND d.position < _unsettled_drops.position -- Can only fill drops ahead of you
      ORDER BY d.position ASC
      LIMIT 1;

      -- No more drops to fill
      IF _target_drop IS NULL THEN
        EXIT;
      END IF;

      -- Calculate how much to fill
      _fill_amount := LEAST(_remaining_amount, _target_drop.target_amount - _target_drop.fill_amount);

      -- Update the target drop's fill amount
      UPDATE drops 
      SET fill_amount = fill_amount + _fill_amount,
          status = CASE 
            WHEN fill_amount + _fill_amount >= target_amount THEN 'completed'
            ELSE 'filling'
          END
      WHERE id = _target_drop.id;

      _remaining_amount := _remaining_amount - _fill_amount;
      _total_distributed := _total_distributed + _fill_amount;

      -- Check if this drop is now complete (bucket is full!)
      IF (_target_drop.fill_amount + _fill_amount) >= _target_drop.target_amount THEN
        -- PAYOUT TIME!
        _payouts_count := _payouts_count + 1;

        -- Mark as paid
        UPDATE drops 
        SET status = 'paid', 
            paid_at = now(),
            completed_at = now()
        WHERE id = _target_drop.id;

        -- Credit user with profit (₦400)
        INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
        VALUES (
          _target_drop.user_id,
          'earnings',
          _config.drop_profit_amount,
          'drop_profit',
          format('Profit from Position #%s', _target_drop.position),
          'completed',
          json_build_object('drop_id', _target_drop.id::text, 'position', _target_drop.position)
        );

        -- System fee (₦100) - already in treasury from entry, just record
        INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
        VALUES (
          '00000000-0000-0000-0000-000000000000',
          'earnings',
          -_config.drop_admin_fee,
          'platform_fee',
          format('Platform fee from Position #%s payout', _target_drop.position),
          'completed',
          json_build_object('drop_id', _target_drop.id::text, 'user_id', _target_drop.user_id::text)
        );

        -- Update spot stats
        UPDATE spots 
        SET total_cycles = total_cycles + 1,
            total_earnings = total_earnings + _config.drop_profit_amount
        WHERE id = _target_drop.spot_id;

        -- Create notification for the winner
        INSERT INTO notifications (user_id, notification_type, title, message, metadata, link)
        VALUES (
          _target_drop.user_id,
          'drop_payout',
          'You Got Paid!',
          format('Position #%s completed! ₦%s profit added to your wallet. Auto re-entering...', _target_drop.position, _config.drop_profit_amount),
          json_build_object('position', _target_drop.position, 'profit', _config.drop_profit_amount),
          '/dashboard'
        );

        -- AUTO RE-ENTRY: Create new drop at end of queue
        SELECT get_next_drop_position() INTO _new_position;
        _reentries_count := _reentries_count + 1;

        INSERT INTO drops (spot_id, position, fill_amount, target_amount, status, source_type, is_settled)
        VALUES (_target_drop.spot_id, _new_position, 0, _config.drop_target_amount, 'waiting', 're-entry', true)
        RETURNING id INTO _new_drop_id;

        -- Mark old drop as re-entered
        UPDATE drops SET status = 're-entered' WHERE id = _target_drop.id;

        -- Record re-entry in ledger (internal tracking - no visible balance change)
        INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
        VALUES (
          _target_drop.user_id,
          'system',
          _config.drop_reentry_amount,
          'drop_reentry',
          format('Auto re-entry to Position #%s', _new_position),
          'completed',
          json_build_object('old_position', _target_drop.position, 'new_position', _new_position, 'new_drop_id', _new_drop_id::text)
        );

      END IF;
    END LOOP;
  END LOOP;

  -- Update pulse record
  UPDATE drop_pulses 
  SET completed_at = now(),
      new_drops_processed = _new_drops_count,
      re_entries_processed = _reentries_count,
      payouts_made = _payouts_count,
      total_distributed = _total_distributed,
      status = 'completed'
  WHERE id = _pulse_id;

  RETURN json_build_object(
    'success', true,
    'pulse_number', _pulse_number,
    'new_drops_processed', _new_drops_count,
    'payouts_made', _payouts_count,
    're_entries_created', _reentries_count,
    'total_distributed', _total_distributed
  );

EXCEPTION WHEN OTHERS THEN
  -- Update pulse as failed
  UPDATE drop_pulses 
  SET status = 'failed',
      completed_at = now()
  WHERE id = _pulse_id;

  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- 16. Function to get user's drops status
CREATE OR REPLACE FUNCTION public.get_user_drops_status(_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _spots JSON;
  _active_count INTEGER;
  _total_earnings DECIMAL;
BEGIN
  -- Get all user's spots with their current drops
  SELECT json_agg(spot_data), COUNT(*), COALESCE(SUM((spot_data->>'total_earnings')::DECIMAL), 0)
  INTO _spots, _active_count, _total_earnings
  FROM (
    SELECT json_build_object(
      'spot_id', s.id,
      'spot_name', s.spot_name,
      'status', s.status,
      'total_cycles', s.total_cycles,
      'total_earnings', s.total_earnings,
      'created_at', s.created_at,
      'current_drop', (
        SELECT json_build_object(
          'drop_id', d.id,
          'position', d.position,
          'fill_amount', d.fill_amount,
          'target_amount', d.target_amount,
          'fill_percentage', ROUND((d.fill_amount / d.target_amount) * 100, 1),
          'status', d.status,
          'source_type', d.source_type
        )
        FROM drops d 
        WHERE d.spot_id = s.id 
          AND d.status IN ('waiting', 'filling')
        ORDER BY d.created_at DESC 
        LIMIT 1
      )
    ) as spot_data
    FROM spots s
    WHERE s.user_id = _user_id AND s.status = 'active'
    ORDER BY s.created_at ASC
  ) subq;

  RETURN json_build_object(
    'spots', COALESCE(_spots, '[]'::json),
    'active_spots_count', COALESCE(_active_count, 0),
    'total_earnings_all_time', COALESCE(_total_earnings, 0)
  );
END;
$$;