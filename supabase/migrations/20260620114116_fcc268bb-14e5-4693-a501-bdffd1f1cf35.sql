
-- =====================================================================
-- 1. PLATFORM CONFIG: add 3 new tunable settings
-- =====================================================================
ALTER TABLE public.platform_config
  ADD COLUMN IF NOT EXISTS unlock_pending_threshold numeric NOT NULL DEFAULT 27000,
  ADD COLUMN IF NOT EXISTS unlock_invites_required integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS unlock_system_active boolean NOT NULL DEFAULT true;

-- =====================================================================
-- 2. UNLOCK_CYCLES TABLE — records each successful unlock claim
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.unlock_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cycle_number integer NOT NULL,
  unlocked_at timestamp with time zone NOT NULL DEFAULT now(),
  consumed_referee_ids uuid[] NOT NULL DEFAULT '{}',
  pending_balance_at_unlock numeric NOT NULL DEFAULT 0,
  silent_earnings_revealed numeric NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, cycle_number)
);

CREATE INDEX IF NOT EXISTS idx_unlock_cycles_user_id ON public.unlock_cycles(user_id);
CREATE INDEX IF NOT EXISTS idx_unlock_cycles_unlocked_at ON public.unlock_cycles(unlocked_at DESC);

-- GRANTS (auth-only table — no anon access)
GRANT SELECT ON public.unlock_cycles TO authenticated;
GRANT ALL ON public.unlock_cycles TO service_role;

-- RLS
ALTER TABLE public.unlock_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own unlock cycles"
  ON public.unlock_cycles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all unlock cycles"
  ON public.unlock_cycles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- (No client INSERT/UPDATE/DELETE policies — writes happen via SECURITY DEFINER RPC only)

-- Enable realtime so the frontend Mainframe reveal happens instantly
ALTER TABLE public.unlock_cycles REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'unlock_cycles'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.unlock_cycles';
  END IF;
END $$;

-- =====================================================================
-- 3. RPC: get_unlock_status — frontend polls this constantly
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_unlock_status(_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_referral_code text;
  v_is_member boolean;
  v_threshold numeric;
  v_invites_required integer;
  v_system_active boolean;
  v_pending_balance numeric;
  v_earnings_balance numeric;
  v_consumed_ids uuid[];
  v_fresh_invites_count integer;
  v_total_cycles integer;
  v_latest_cycle_number integer;
  v_latest_unlocked_at timestamptz;
  v_is_unlocked boolean;
BEGIN
  -- Resolve caller. If _user_id passed AND caller is admin, allow lookup of other users.
  v_user_id := COALESCE(_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF v_user_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  -- Profile basics
  SELECT referral_code, COALESCE(is_member, false)
    INTO v_referral_code, v_is_member
  FROM public.profiles WHERE id = v_user_id;

  -- Platform config
  SELECT
    COALESCE(unlock_pending_threshold, 27000),
    COALESCE(unlock_invites_required, 3),
    COALESCE(unlock_system_active, true)
    INTO v_threshold, v_invites_required, v_system_active
  FROM public.platform_config WHERE id = 1;

  -- Balances
  SELECT COALESCE(SUM(amount), 0) INTO v_pending_balance
  FROM public.transactions
  WHERE user_id = v_user_id AND wallet_type = 'pending';
  v_pending_balance := GREATEST(v_pending_balance, 0);

  SELECT COALESCE(SUM(amount), 0) INTO v_earnings_balance
  FROM public.transactions
  WHERE user_id = v_user_id AND wallet_type = 'earnings';
  v_earnings_balance := GREATEST(v_earnings_balance, 0);

  -- All referee ids ever consumed by previous unlock cycles
  SELECT COALESCE(array_agg(DISTINCT id), '{}')
    INTO v_consumed_ids
  FROM (
    SELECT unnest(consumed_referee_ids) AS id
    FROM public.unlock_cycles
    WHERE user_id = v_user_id
  ) x;

  -- Fresh activated referees = members who paid (activated_at IS NOT NULL)
  -- AND were referred by me AND were NOT already consumed by a previous cycle
  SELECT COUNT(*) INTO v_fresh_invites_count
  FROM public.profiles p
  WHERE v_referral_code IS NOT NULL
    AND LOWER(p.referred_by_code) = LOWER(v_referral_code)
    AND COALESCE(p.is_member, false) = true
    AND p.activated_at IS NOT NULL
    AND NOT (p.id = ANY(v_consumed_ids));

  -- Unlock cycle stats
  SELECT COUNT(*), MAX(cycle_number), MAX(unlocked_at)
    INTO v_total_cycles, v_latest_cycle_number, v_latest_unlocked_at
  FROM public.unlock_cycles WHERE user_id = v_user_id;

  -- is_unlocked: simple model — user is in Mainframe once they have at least
  -- one unlock cycle on record. The withdraw-gate logic for repeat cycles is
  -- a SEPARATE frontend check (pending_balance >= threshold AND fresh_invites_count < required).
  v_is_unlocked := COALESCE(v_total_cycles, 0) > 0;

  -- If the unlock system is OFF (kill switch), everyone is treated as unlocked.
  IF v_system_active IS NOT TRUE THEN
    v_is_unlocked := true;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'is_member', v_is_member,
    'system_active', v_system_active,
    'is_unlocked', v_is_unlocked,
    'pending_threshold', v_threshold,
    'invites_required', v_invites_required,
    'pending_balance', v_pending_balance,
    'earnings_balance', v_earnings_balance,
    'fresh_invites_count', v_fresh_invites_count,
    'consumed_invites_count', COALESCE(array_length(v_consumed_ids, 1), 0),
    'total_unlock_cycles', COALESCE(v_total_cycles, 0),
    'current_cycle_number', COALESCE(v_latest_cycle_number, 0),
    'latest_unlocked_at', v_latest_unlocked_at,
    -- "ready_to_unlock" = the user has met both gates for the NEXT unlock
    'ready_to_unlock',
      v_is_member
      AND v_system_active
      AND v_pending_balance >= v_threshold
      AND v_fresh_invites_count >= v_invites_required,
    -- "withdraw_gated" = currently in Mainframe BUT pending built back up and they need more invites
    'withdraw_gated',
      v_is_unlocked
      AND v_system_active
      AND v_pending_balance >= v_threshold
      AND v_fresh_invites_count < v_invites_required
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_unlock_status(uuid) TO authenticated, service_role;

-- =====================================================================
-- 4. RPC: try_consume_unlock — atomically claim a new unlock cycle
-- =====================================================================
CREATE OR REPLACE FUNCTION public.try_consume_unlock(_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_referral_code text;
  v_is_member boolean;
  v_threshold numeric;
  v_invites_required integer;
  v_system_active boolean;
  v_pending_balance numeric;
  v_earnings_balance numeric;
  v_consumed_ids uuid[];
  v_fresh_ids uuid[];
  v_to_consume_ids uuid[];
  v_next_cycle integer;
  v_new_cycle_id uuid;
BEGIN
  v_user_id := COALESCE(_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF v_user_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  -- SERIALIZE: hold a row lock on the profile so two parallel claim attempts
  -- can't both succeed on the same set of 3 fresh invites.
  PERFORM 1 FROM public.profiles WHERE id = v_user_id FOR UPDATE;

  SELECT referral_code, COALESCE(is_member, false)
    INTO v_referral_code, v_is_member
  FROM public.profiles WHERE id = v_user_id;

  IF NOT v_is_member THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not an active member');
  END IF;

  SELECT
    COALESCE(unlock_pending_threshold, 27000),
    COALESCE(unlock_invites_required, 3),
    COALESCE(unlock_system_active, true)
    INTO v_threshold, v_invites_required, v_system_active
  FROM public.platform_config WHERE id = 1;

  IF NOT v_system_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unlock system disabled');
  END IF;

  -- Pending must meet threshold
  SELECT COALESCE(SUM(amount), 0) INTO v_pending_balance
  FROM public.transactions
  WHERE user_id = v_user_id AND wallet_type = 'pending';
  v_pending_balance := GREATEST(v_pending_balance, 0);

  IF v_pending_balance < v_threshold THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pending balance below threshold',
      'pending_balance', v_pending_balance,
      'pending_threshold', v_threshold
    );
  END IF;

  -- Find the pool of fresh activated referees (not yet consumed)
  SELECT COALESCE(array_agg(DISTINCT id), '{}')
    INTO v_consumed_ids
  FROM (
    SELECT unnest(consumed_referee_ids) AS id
    FROM public.unlock_cycles
    WHERE user_id = v_user_id
  ) x;

  SELECT COALESCE(array_agg(p.id ORDER BY p.activated_at ASC), '{}')
    INTO v_fresh_ids
  FROM public.profiles p
  WHERE v_referral_code IS NOT NULL
    AND LOWER(p.referred_by_code) = LOWER(v_referral_code)
    AND COALESCE(p.is_member, false) = true
    AND p.activated_at IS NOT NULL
    AND NOT (p.id = ANY(v_consumed_ids));

  IF COALESCE(array_length(v_fresh_ids, 1), 0) < v_invites_required THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not enough fresh invites',
      'fresh_invites_count', COALESCE(array_length(v_fresh_ids, 1), 0),
      'invites_required', v_invites_required
    );
  END IF;

  -- Take the OLDEST N fresh activations (first in, first consumed — fair)
  v_to_consume_ids := v_fresh_ids[1:v_invites_required];

  -- Earnings balance to reveal (silent accumulation)
  SELECT COALESCE(SUM(amount), 0) INTO v_earnings_balance
  FROM public.transactions
  WHERE user_id = v_user_id AND wallet_type = 'earnings';
  v_earnings_balance := GREATEST(v_earnings_balance, 0);

  -- Next cycle number
  SELECT COALESCE(MAX(cycle_number), 0) + 1 INTO v_next_cycle
  FROM public.unlock_cycles WHERE user_id = v_user_id;

  INSERT INTO public.unlock_cycles (
    user_id, cycle_number, consumed_referee_ids,
    pending_balance_at_unlock, silent_earnings_revealed
  ) VALUES (
    v_user_id, v_next_cycle, v_to_consume_ids,
    v_pending_balance, v_earnings_balance
  )
  RETURNING id INTO v_new_cycle_id;

  -- Notify the user (first unlock gets a special title)
  PERFORM public.create_notification(
    _user_id := v_user_id,
    _type := 'unlock_claimed',
    _title := CASE WHEN v_next_cycle = 1
      THEN 'System Synchronized!'
      ELSE format('Unlock #%s claimed!', v_next_cycle)
    END,
    _message := format(
      '₦%s pending balance authorized for migration. ₦%s now available in your wallet.',
      to_char(v_pending_balance, 'FM999,999,990'),
      to_char(v_earnings_balance, 'FM999,999,990')
    ),
    _metadata := jsonb_build_object(
      'cycle_number', v_next_cycle,
      'consumed_referee_ids', v_to_consume_ids,
      'pending_balance_at_unlock', v_pending_balance,
      'silent_earnings_revealed', v_earnings_balance
    ),
    _link := '/dashboard'
  );

  RETURN jsonb_build_object(
    'success', true,
    'cycle_id', v_new_cycle_id,
    'cycle_number', v_next_cycle,
    'consumed_referee_ids', v_to_consume_ids,
    'pending_balance_at_unlock', v_pending_balance,
    'silent_earnings_revealed', v_earnings_balance,
    'is_first_unlock', v_next_cycle = 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_consume_unlock(uuid) TO authenticated, service_role;
