
CREATE OR REPLACE FUNCTION public.expire_stale_payment_attempts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_expired_count int;
BEGIN
  WITH expired AS (
    UPDATE public.payment_attempts pa
    SET status = 'expired',
        metadata = COALESCE(pa.metadata, '{}'::jsonb) || jsonb_build_object(
          'expired_at', now(),
          'expired_reason', 'No completion after 1 hour'
        )
    WHERE pa.status = 'pending'
      AND pa.provider IN ('paystack', 'flutterwave')
      AND pa.created_at < now() - interval '1 hour'
      AND NOT EXISTS (
        SELECT 1 FROM public.payment_attempts other
        WHERE other.tx_ref = pa.tx_ref
          AND other.status = 'verified'
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_expired_count FROM expired;

  RETURN jsonb_build_object(
    'success', true,
    'expired_count', v_expired_count,
    'ran_at', now()
  );
END;
$$;
