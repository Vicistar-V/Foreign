-- Step 1: Delete any existing transactions with drop-related types (cleanup old data)
DELETE FROM transactions WHERE transaction_type IN ('drop_entry', 'drop_win', 'drop_refund');

-- Step 2: Drop the index that references transaction_type
DROP INDEX IF EXISTS idx_transactions_user_notification_read;

-- Step 3: Create new transaction_type enum without drop types
CREATE TYPE transaction_type_new AS ENUM (
  'membership_bonus',
  'deposit',
  'withdrawal',
  'debt_reversal',
  'platform_fee',
  'subsidy',
  'membership_fee',
  'referral_payout',
  'voucher_issuance',
  'credit_redemption',
  'admin_expense',
  'welcome_bonus'
);

-- Step 4: Alter the transactions table to use the new enum
ALTER TABLE transactions 
  ALTER COLUMN transaction_type TYPE transaction_type_new 
  USING transaction_type::text::transaction_type_new;

-- Step 5: Drop old enum and rename new one
DROP TYPE transaction_type;
ALTER TYPE transaction_type_new RENAME TO transaction_type;

-- Step 6: Recreate the index
CREATE INDEX idx_transactions_user_notification_read 
ON transactions (user_id, read_at) 
WHERE status = 'completed';

-- Step 7: Drop the orphaned result_status enum (not used by any table)
DROP TYPE IF EXISTS result_status;