
ALTER TABLE public.payment_attempts
  DROP CONSTRAINT IF EXISTS payment_attempts_status_check;

ALTER TABLE public.payment_attempts
  ADD CONSTRAINT payment_attempts_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'verified'::text, 'failed'::text, 'expired'::text]));
