-- Fix Vivian's self-referred account (060eee05-bd99-4d27-a85e-291d498beee0)

-- Step 1: Reset last_payout_at so she can receive payouts
UPDATE profiles 
SET last_payout_at = NULL
WHERE id = '060eee05-bd99-4d27-a85e-291d498beee0';

-- Step 2: Credit her earnings with ₦900 goodwill compensation
INSERT INTO transactions (user_id, transaction_type, wallet_type, amount, description, status)
VALUES (
  '060eee05-bd99-4d27-a85e-291d498beee0',
  'subsidy',
  'earnings',
  900,
  'Compensation for system error - payouts incorrectly recycled',
  'completed'
);

-- Step 3: Pay the pending ₦500 referral bonus to Vivian's main account (correct ID)
INSERT INTO transactions (user_id, transaction_type, wallet_type, amount, description, status, metadata)
VALUES (
  'dae463a3-767c-46fe-bed7-a9d27f9a4548',
  'referral_first_cycle_bonus',
  'earnings',
  500,
  'Referral bonus - Vivian Self Refer completed first cycle',
  'completed',
  '{"referee_id": "060eee05-bd99-4d27-a85e-291d498beee0"}'::jsonb
);

-- Mark the pending bonus as paid
UPDATE pending_referral_bonuses
SET status = 'paid', paid_at = NOW()
WHERE referee_id = '060eee05-bd99-4d27-a85e-291d498beee0' AND status = 'pending';

-- Step 4: Refresh cached balances for both accounts
SELECT refresh_user_cache('060eee05-bd99-4d27-a85e-291d498beee0');
SELECT refresh_user_cache('dae463a3-767c-46fe-bed7-a9d27f9a4548');