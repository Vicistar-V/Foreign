-- Step 1: Delete the extra ₦1,000 JACKPOT transaction for Chinedu
DELETE FROM public.transactions 
WHERE id = 'ee3e1459-be4d-4d18-a1a1-689f38d1d77e';

-- Step 2: Insert ₦200 protection refund for Chinedu
INSERT INTO public.transactions (
  user_id,
  wallet_type,
  amount,
  transaction_type,
  description,
  status,
  metadata
) VALUES (
  'f73e5c41-41cf-4a8a-a64c-1d4aacf5e4f3',
  'earnings',
  200,
  'drop_refund',
  'Protected refund - Daily Distribution 2025-12-29',
  'completed',
  '{"corrected": true, "admin_note": "Replaced incorrect jackpot with protection"}'::jsonb
);