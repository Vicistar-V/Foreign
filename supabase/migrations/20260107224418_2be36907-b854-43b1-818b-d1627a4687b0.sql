-- Remove the zero balance refresh transactions
DELETE FROM public.transactions
WHERE amount = 0
  AND transaction_type = 'subsidy'
  AND description = 'Balance refresh'
  AND status = 'completed';