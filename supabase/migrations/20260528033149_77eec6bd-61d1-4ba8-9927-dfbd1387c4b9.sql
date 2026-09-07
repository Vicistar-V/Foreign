
-- 1. Add Moniepoint columns to platform_config
ALTER TABLE public.platform_config
  ADD COLUMN IF NOT EXISTS payment_provider text NOT NULL DEFAULT 'moniepoint',
  ADD COLUMN IF NOT EXISTS moniepoint_account_number text,
  ADD COLUMN IF NOT EXISTS moniepoint_account_name text,
  ADD COLUMN IF NOT EXISTS moniepoint_bank_name text NOT NULL DEFAULT 'Moniepoint MFB';

-- 2. Add Moniepoint columns to payment_attempts
ALTER TABLE public.payment_attempts
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'flutterwave',
  ADD COLUMN IF NOT EXISTS sender_bank_code text,
  ADD COLUMN IF NOT EXISTS sender_bank_name text,
  ADD COLUMN IF NOT EXISTS sender_account_number text,
  ADD COLUMN IF NOT EXISTS unique_amount numeric;

CREATE INDEX IF NOT EXISTS idx_payment_attempts_pending_moniepoint
  ON public.payment_attempts (provider, status, sender_account_number, unique_amount)
  WHERE status = 'pending' AND provider = 'moniepoint';

-- Allow user to read their own attempt by id (already covered) — add insert grant for safety
GRANT SELECT ON public.payment_attempts TO authenticated;

-- 3. Unmatched Moniepoint payments table (admin can manually credit)
CREATE TABLE IF NOT EXISTS public.unmatched_moniepoint_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_reference text UNIQUE,
  amount numeric NOT NULL,
  sender_account_number text,
  sender_account_name text,
  sender_bank_name text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  resolved_user_id uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.unmatched_moniepoint_payments TO authenticated;
GRANT ALL ON public.unmatched_moniepoint_payments TO service_role;

ALTER TABLE public.unmatched_moniepoint_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view unmatched payments"
  ON public.unmatched_moniepoint_payments FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update unmatched payments"
  ON public.unmatched_moniepoint_payments FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages unmatched payments"
  ON public.unmatched_moniepoint_payments FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 4. Update get_platform_config: keep stripping secrets; new public Moniepoint
-- fields are returned automatically via to_jsonb(c).
-- (Already returns to_jsonb(c) minus admin_alert_email and invite_access_key,
--  so the new payment_provider + moniepoint_* columns will flow through.)
-- No change needed.
