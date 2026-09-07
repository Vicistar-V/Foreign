-- Safe public live signals for realtime refreshes without exposing private rows.
CREATE TABLE IF NOT EXISTS public.live_update_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.live_update_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view safe live signals" ON public.live_update_signals;
CREATE POLICY "Anyone can view safe live signals"
ON public.live_update_signals
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Service role can create safe live signals" ON public.live_update_signals;
CREATE POLICY "Service role can create safe live signals"
ON public.live_update_signals
FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'service_role');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'live_update_signals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_update_signals;
  END IF;
END $$;

-- Realtime channel authorization: private channels must include the signed-in user's ID.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Safe public live channels are readable" ON realtime.messages;
CREATE POLICY "Safe public live channels are readable"
ON realtime.messages
FOR SELECT
TO anon, authenticated
USING (
  realtime.topic() IN (
    'public:queue-live',
    'public:earnings-live',
    'public:network-live'
  )
);

DROP POLICY IF EXISTS "Users can read their own private live channels" ON realtime.messages;
CREATE POLICY "Users can read their own private live channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = ('user:' || auth.uid()::text)
  OR realtime.topic() LIKE ('user:' || auth.uid()::text || ':%')
);

-- Prevent users from self-verifying withdrawal accounts.
REVOKE UPDATE ON public.withdrawal_accounts FROM anon, authenticated;
GRANT UPDATE (bank_code, bank_name, account_number, account_name, is_primary) ON public.withdrawal_accounts TO authenticated;
GRANT ALL ON public.withdrawal_accounts TO service_role;

CREATE OR REPLACE FUNCTION public.keep_withdrawal_verification_server_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    RAISE EXCEPTION 'Bank verification can only be changed by the server';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS keep_withdrawal_verification_server_only ON public.withdrawal_accounts;
CREATE TRIGGER keep_withdrawal_verification_server_only
BEFORE UPDATE ON public.withdrawal_accounts
FOR EACH ROW
EXECUTE FUNCTION public.keep_withdrawal_verification_server_only();

-- Keep PIN hashes server-side only.
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id,
  full_name,
  phone_number,
  referral_code,
  referred_by_code,
  is_name_locked,
  is_member,
  created_at,
  avatar_url,
  metadata,
  banned_at,
  banned_reason,
  is_banned,
  last_seen_at,
  last_payout_at,
  auto_compound_enabled
) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

CREATE OR REPLACE FUNCTION public.keep_profile_pin_server_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.pin_hash IS DISTINCT FROM OLD.pin_hash THEN
    RAISE EXCEPTION 'PIN setup can only be changed securely by the server';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS keep_profile_pin_server_only ON public.profiles;
CREATE TRIGGER keep_profile_pin_server_only
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.keep_profile_pin_server_only();

-- Make browser support-message edits read-status-only.
REVOKE UPDATE ON public.ticket_messages FROM anon, authenticated;
GRANT UPDATE (read_at) ON public.ticket_messages TO authenticated;
GRANT ALL ON public.ticket_messages TO service_role;

CREATE OR REPLACE FUNCTION public.keep_ticket_message_details_safe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.ticket_id IS DISTINCT FROM OLD.ticket_id
    OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
    OR NEW.sender_type IS DISTINCT FROM OLD.sender_type
    OR NEW.message IS DISTINCT FROM OLD.message
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.metadata IS DISTINCT FROM OLD.metadata
    OR NEW.image_url IS DISTINCT FROM OLD.image_url THEN
    RAISE EXCEPTION 'Only the read status can be changed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS keep_ticket_message_details_safe ON public.ticket_messages;
CREATE TRIGGER keep_ticket_message_details_safe
BEFORE UPDATE ON public.ticket_messages
FOR EACH ROW
EXECUTE FUNCTION public.keep_ticket_message_details_safe();

-- Count spot cycles exactly when a drop is first marked paid/re-entered.
CREATE OR REPLACE FUNCTION public.update_spot_totals_when_drop_finishes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profit numeric := 0;
BEGIN
  IF NEW.status IN ('paid', 're-entered')
     AND COALESCE(OLD.status, '') NOT IN ('paid', 're-entered') THEN
    SELECT COALESCE(drop_profit_amount_subsequent, drop_profit_amount, 0)
    INTO v_profit
    FROM public.platform_config
    WHERE id = 1;

    UPDATE public.spots
    SET total_cycles = COALESCE(total_cycles, 0) + 1,
        total_earnings = COALESCE(total_earnings, 0) + v_profit
    WHERE id = NEW.spot_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_spot_totals_when_drop_finishes ON public.drops;
CREATE TRIGGER update_spot_totals_when_drop_finishes
AFTER UPDATE OF status ON public.drops
FOR EACH ROW
EXECUTE FUNCTION public.update_spot_totals_when_drop_finishes();

-- Emit a safe queue signal any time the queue changes, so the UI can refetch secure edge functions.
CREATE OR REPLACE FUNCTION public.emit_safe_queue_live_signal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.live_update_signals (signal_type, metadata)
  VALUES (
    'queue_changed',
    jsonb_build_object(
      'table_name', TG_TABLE_NAME,
      'event', TG_OP
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS emit_safe_queue_live_signal_on_drops ON public.drops;
CREATE TRIGGER emit_safe_queue_live_signal_on_drops
AFTER INSERT OR UPDATE OR DELETE ON public.drops
FOR EACH ROW
EXECUTE FUNCTION public.emit_safe_queue_live_signal();

DROP TRIGGER IF EXISTS emit_safe_queue_live_signal_on_spots ON public.spots;
CREATE TRIGGER emit_safe_queue_live_signal_on_spots
AFTER INSERT OR UPDATE OR DELETE ON public.spots
FOR EACH ROW
EXECUTE FUNCTION public.emit_safe_queue_live_signal();