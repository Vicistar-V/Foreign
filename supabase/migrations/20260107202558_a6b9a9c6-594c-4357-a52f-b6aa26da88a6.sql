-- Fix Vivian's balance to ₦1,200 (not 1,002)
-- Add back the 198 we subtracted
INSERT INTO public.transactions (
  user_id, wallet_type, amount, transaction_type, description, status, metadata
) VALUES (
  'dae463a3-767c-46fe-bed7-a9d27f9a4548',
  'earnings',
  198,
  'subsidy',
  'Balance correction: restore to ₦1,200',
  'completed',
  '{"reason": "support_correction"}'::jsonb
);

-- Clear cache
DELETE FROM public.cached_balances WHERE user_id = 'dae463a3-767c-46fe-bed7-a9d27f9a4548';