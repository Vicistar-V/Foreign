-- Add bank_code column to withdrawal_accounts table
ALTER TABLE public.withdrawal_accounts 
ADD COLUMN bank_code TEXT;

-- Add index for faster lookups
CREATE INDEX idx_withdrawal_accounts_bank_code ON public.withdrawal_accounts(bank_code);

-- Add comment explaining the fix
COMMENT ON COLUMN public.withdrawal_accounts.bank_code IS 'Bank code used for Flutterwave transfers (e.g., 044 for Access Bank). Previously bank_name incorrectly stored account holder name.';