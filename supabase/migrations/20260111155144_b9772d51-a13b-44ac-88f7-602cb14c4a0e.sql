-- Undo Vivian's account fix transactions

-- Delete the ₦900 compensation transaction
DELETE FROM transactions 
WHERE user_id = '060eee05-bd99-4d27-a85e-291d498beee0' 
  AND transaction_type = 'subsidy' 
  AND amount = 900
  AND description = 'Compensation for system error - payouts incorrectly recycled';

-- Delete the ₦500 referral bonus transaction
DELETE FROM transactions 
WHERE user_id = 'dae463a3-767c-46fe-bed7-a9d27f9a4548' 
  AND transaction_type = 'referral_first_cycle_bonus' 
  AND amount = 500
  AND description = 'Referral bonus - Vivian Self Refer completed first cycle';

-- Reset pending bonus back to pending
UPDATE pending_referral_bonuses
SET status = 'pending', paid_at = NULL
WHERE referee_id = '060eee05-bd99-4d27-a85e-291d498beee0';

-- Restore last_payout_at to original value
UPDATE profiles 
SET last_payout_at = '2026-01-11 14:24:15.117177+00'
WHERE id = '060eee05-bd99-4d27-a85e-291d498beee0';

-- Refresh cached balances
SELECT refresh_user_cache('060eee05-bd99-4d27-a85e-291d498beee0');
SELECT refresh_user_cache('dae463a3-767c-46fe-bed7-a9d27f9a4548');