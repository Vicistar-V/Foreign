-- Manual activation for MOHAMMED JIBRIN (payment confirmed via Flutterwave ID: 1949660501)
-- His user_id: cfc0ae8a-4dd8-4c0d-8f82-1315c2fac11f

-- Step 1: Insert membership fee transaction to SYSTEM_TREASURY (triggers membership activation)
INSERT INTO public.transactions (
  user_id,
  wallet_type,
  amount,
  transaction_type,
  description,
  status,
  payment_reference,
  metadata
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'earnings',
  1000.00,
  'membership_fee',
  'Membership fee - Manual admin verification (Flutterwave #1949660501)',
  'completed',
  'FLW-1949660501',
  jsonb_build_object(
    'original_user_id', 'cfc0ae8a-4dd8-4c0d-8f82-1315c2fac11f',
    'flutterwave_id', '1949660501',
    'admin_verified', true,
    'verified_at', now(),
    'reason', 'Payment confirmed since Dec 30 - manual activation'
  )
);