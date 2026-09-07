-- STEP 3A: Drop functions that reference transaction_type
DROP FUNCTION IF EXISTS atomic_wallet_transfer(uuid, wallet_type, wallet_type, numeric, text);
DROP FUNCTION IF EXISTS atomic_initiate_withdrawal(uuid, numeric, numeric, text, text);
DROP FUNCTION IF EXISTS atomic_admin_credit(uuid, numeric, wallet_type, text, uuid);
DROP FUNCTION IF EXISTS atomic_chargeback_reversal(uuid, uuid, text, numeric, numeric);
DROP FUNCTION IF EXISTS process_referral_commission() CASCADE;