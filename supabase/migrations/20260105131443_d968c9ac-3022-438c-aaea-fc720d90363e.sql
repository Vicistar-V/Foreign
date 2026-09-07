-- STEP 2: Delete cycle transactions and drop functions
DELETE FROM transactions 
WHERE transaction_type::text IN ('cycle_entry', 'cycle_payout', 'cycle_reentry', 'cycle_referral');

-- Drop cycle functions
DROP FUNCTION IF EXISTS join_cycle_queue(uuid, boolean);
DROP FUNCTION IF EXISTS distribute_cycle_funds(numeric, uuid);
DROP FUNCTION IF EXISTS process_cycle_payout(uuid);
DROP FUNCTION IF EXISTS get_cycle_queue_stats();
DROP FUNCTION IF EXISTS get_user_cycle_positions(uuid);

-- Remove cycler columns from platform_config
ALTER TABLE platform_config 
  DROP COLUMN IF EXISTS cycler_enabled,
  DROP COLUMN IF EXISTS cycler_entry_fee,
  DROP COLUMN IF EXISTS cycler_payout_target,
  DROP COLUMN IF EXISTS cycler_admin_fee,
  DROP COLUMN IF EXISTS cycler_auto_reentry_amount,
  DROP COLUMN IF EXISTS cycler_user_profit,
  DROP COLUMN IF EXISTS cycler_referral_bonus,
  DROP COLUMN IF EXISTS cycler_first_cycle_profit;