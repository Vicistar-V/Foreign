-- Drop problematic index first
DROP INDEX IF EXISTS idx_transactions_user_notification_read;

-- Create new clean enum
CREATE TYPE transaction_type_v5 AS ENUM (
  'membership_bonus',
  'deposit',
  'drop_entry',
  'drop_win',
  'drop_refund',
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

-- Convert column to text
ALTER TABLE transactions 
  ALTER COLUMN transaction_type TYPE text 
  USING transaction_type::text;

-- Drop old enum
DROP TYPE transaction_type;

-- Rename new enum
ALTER TYPE transaction_type_v5 RENAME TO transaction_type;

-- Convert column back to new enum
ALTER TABLE transactions 
  ALTER COLUMN transaction_type TYPE transaction_type 
  USING transaction_type::transaction_type;