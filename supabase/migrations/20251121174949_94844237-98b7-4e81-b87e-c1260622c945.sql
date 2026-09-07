-- Drop the process_internal_transfer function
DROP FUNCTION IF EXISTS public.process_internal_transfer(uuid, numeric, wallet_type, wallet_type, uuid);

-- Remove internal_transfer from transaction_type enum
-- Note: Postgres doesn't allow removing enum values directly, so we need to recreate the enum

-- Step 1: Create new enum without internal_transfer
CREATE TYPE public.transaction_type_new AS ENUM (
  'membership_bonus',
  'deposit',
  'drop_entry',
  'drop_win',
  'drop_refund',
  'withdrawal',
  'debt_reversal',
  'platform_fee',
  'subsidy',
  'membership_fee'
);

-- Step 2: Alter the transactions table to use the new enum
ALTER TABLE public.transactions 
  ALTER COLUMN transaction_type TYPE transaction_type_new 
  USING transaction_type::text::transaction_type_new;

-- Step 3: Drop the old enum
DROP TYPE public.transaction_type;

-- Step 4: Rename the new enum to the original name
ALTER TYPE public.transaction_type_new RENAME TO transaction_type;