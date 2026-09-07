-- Drop the foreign key constraint (we shouldn't reference auth.users directly)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Insert SYSTEM_TREASURY special user
-- This is a special profile that acts as the platform treasury
INSERT INTO public.profiles (
  id, 
  full_name, 
  referral_code, 
  is_name_locked, 
  is_member
) VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'SYSTEM_TREASURY',
  'SYSTEM',
  true,
  true
) ON CONFLICT (id) DO NOTHING;

-- Initialize platform_config with default values
INSERT INTO public.platform_config (
  id,
  membership_fee,
  drop_entry_fee,
  referral_cash_bonus,
  referral_credit_bonus,
  platform_fee_percentage,
  protected_percentage,
  beneficiary_percentage,
  minimum_withdrawal,
  is_drop_active,
  maintenance_mode
) VALUES (
  1,
  1000,
  200,
  500,
  20,
  10,
  50,
  20,
  1000,
  true,
  false
) ON CONFLICT (id) DO UPDATE SET
  membership_fee = EXCLUDED.membership_fee,
  drop_entry_fee = EXCLUDED.drop_entry_fee,
  referral_cash_bonus = EXCLUDED.referral_cash_bonus,
  referral_credit_bonus = EXCLUDED.referral_credit_bonus,
  platform_fee_percentage = EXCLUDED.platform_fee_percentage,
  protected_percentage = EXCLUDED.protected_percentage,
  beneficiary_percentage = EXCLUDED.beneficiary_percentage,
  minimum_withdrawal = EXCLUDED.minimum_withdrawal,
  is_drop_active = EXCLUDED.is_drop_active,
  maintenance_mode = EXCLUDED.maintenance_mode;

-- Initialize SYSTEM_TREASURY balances
INSERT INTO public.user_balances (
  user_id,
  earnings_balance,
  deposit_balance,
  credits_balance
) VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  0,
  0,
  0
) ON CONFLICT (user_id) DO NOTHING;

-- Create validation constraint for platform_config percentages
ALTER TABLE public.platform_config 
ADD CONSTRAINT check_percentage_total 
CHECK (protected_percentage + beneficiary_percentage <= 100);

-- Add documentation comments
COMMENT ON TABLE public.profiles IS 'Member profiles. Special user 00000000-0000-0000-0000-000000000000 is SYSTEM_TREASURY for platform operations.';
COMMENT ON TABLE public.platform_config IS 'Platform configuration - only one row should exist with id=1';
COMMENT ON TABLE public.user_balances IS 'Cached balances updated automatically by triggers. Always calculated from transactions table.';