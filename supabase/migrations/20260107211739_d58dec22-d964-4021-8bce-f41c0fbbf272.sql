-- Undo the ₦1,100 transaction added to SYSTEM_TREASURY
DELETE FROM public.transactions 
WHERE user_id = '00000000-0000-0000-0000-000000000000' 
  AND amount = 1100 
  AND description = 'Withdrawal fee recovery'
  AND transaction_type = 'platform_fee';