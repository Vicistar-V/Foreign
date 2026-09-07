CREATE OR REPLACE FUNCTION public.expire_stale_payment_attempts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_expired_gateway int;
  v_expired_moniepoint int;
BEGIN
  -- Paystack / Flutterwave: 1 hour window
  WITH expired_gw AS (
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
  SELECT COUNT(*) INTO v_expired_gateway FROM expired_gw;

  -- Moniepoint bank transfer: 2 hour window (gives email webhook + admin time)
  WITH expired_mnp AS (
    UPDATE public.payment_attempts pa
    SET status = 'expired',
        metadata = COALESCE(pa.metadata, '{}'::jsonb) || jsonb_build_object(
          'expired_at', now(),
          'expired_reason', 'No matching Moniepoint credit after 2 hours'
        )
    WHERE pa.status = 'pending'
      AND pa.provider = 'moniepoint'
      AND pa.created_at < now() - interval '2 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.payment_attempts other
        WHERE other.tx_ref = pa.tx_ref
          AND other.status = 'verified'
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_expired_moniepoint FROM expired_mnp;

  RETURN jsonb_build_object(
    'success', true,
    'expired_count', v_expired_gateway + v_expired_moniepoint,
    'expired_gateway', v_expired_gateway,
    'expired_moniepoint', v_expired_moniepoint,
    'ran_at', now()
  );
END;
$$;