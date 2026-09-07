-- Insert zero transaction for all members to refresh their cached balances
INSERT INTO public.transactions (user_id, wallet_type, amount, transaction_type, description, status)
SELECT 
  id as user_id,
  'earnings' as wallet_type,
  0 as amount,
  'subsidy' as transaction_type,
  'Balance refresh' as description,
  'completed' as status
FROM public.profiles
WHERE is_member = true;