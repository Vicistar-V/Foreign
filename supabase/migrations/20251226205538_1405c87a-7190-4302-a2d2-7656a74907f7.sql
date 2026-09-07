UPDATE public.user_balances 
SET 
  earnings_balance = 0,
  deposit_balance = 0,
  credits_balance = 0,
  last_updated = now()
WHERE user_id = '5d7a5ea2-034c-4665-86b6-816d81dc0330'