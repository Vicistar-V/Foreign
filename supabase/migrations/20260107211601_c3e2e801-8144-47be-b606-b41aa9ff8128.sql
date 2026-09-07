-- Add ₦1,100 to SYSTEM_TREASURY
INSERT INTO public.transactions (user_id, wallet_type, amount, transaction_type, description, status)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'earnings',
  1100,
  'platform_fee',
  'Withdrawal fee recovery',
  'completed'
);