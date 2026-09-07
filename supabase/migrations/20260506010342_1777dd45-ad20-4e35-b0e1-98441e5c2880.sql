INSERT INTO public.transactions (
  user_id,
  wallet_type,
  amount,
  transaction_type,
  description,
  status,
  metadata
)
SELECT
  ref.id,
  'earnings'::public.wallet_type,
  cfg.drop_referral_per_cycle,
  'drop_referral_cycle'::public.transaction_type,
  'Cycle thank-you from ' || COALESCE(NULLIF(trim(p.full_name), ''), 'your friend'),
  'completed'::public.transaction_status,
  jsonb_build_object(
    'referee_id', s.user_id,
    'referee_name', p.full_name,
    'spot_id', s.id,
    'drop_id', d.id,
    'backfilled_missing_cycle_bonus', true,
    'reason', 'Referrer should receive the recurring cycle bonus for every completed cycle'
  )
FROM public.drops d
JOIN public.spots s ON s.id = d.spot_id
JOIN public.profiles p ON p.id = s.user_id
JOIN public.profiles ref ON ref.referral_code = p.referred_by_code
CROSS JOIN public.platform_config cfg
WHERE cfg.id = 1
  AND cfg.drop_referral_per_cycle > 0
  AND d.status = 'paid'
  AND p.referred_by_code IS NOT NULL
  AND p.referred_by_code <> ''
  AND p.referred_by_code <> 'SYSTEM'
  AND NOT EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.user_id = ref.id
      AND t.wallet_type = 'earnings'::public.wallet_type
      AND t.transaction_type = 'drop_referral_cycle'::public.transaction_type
      AND t.metadata->>'referee_id' = s.user_id::text
      AND t.metadata->>'drop_id' = d.id::text
  );