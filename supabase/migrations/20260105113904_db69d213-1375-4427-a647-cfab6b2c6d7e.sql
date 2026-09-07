-- =====================================================
-- VIKETA V4 CLEANUP MIGRATION
-- Removes all obsolete lottery/drop/instant play system
-- =====================================================

-- =====================================================
-- PHASE 1: Drop Obsolete RPC Functions
-- =====================================================

-- Old instant play functions
DROP FUNCTION IF EXISTS public.atomic_play_instant(uuid, numeric);
DROP FUNCTION IF EXISTS public.seed_instant_pool(integer);
DROP FUNCTION IF EXISTS public.get_instant_pool_stats();

-- Old daily drop functions
DROP FUNCTION IF EXISTS public.atomic_join_drop(uuid, date, numeric);
DROP FUNCTION IF EXISTS public.can_join_drop(uuid);
DROP FUNCTION IF EXISTS public.can_join_drop(uuid, date);
DROP FUNCTION IF EXISTS public.atomic_process_distribution(date, numeric, numeric, jsonb, jsonb, uuid[]);
DROP FUNCTION IF EXISTS public.batch_credit_winners(jsonb);
DROP FUNCTION IF EXISTS public.batch_process_protected(jsonb);

-- =====================================================
-- PHASE 2: Drop Obsolete Tables
-- =====================================================

-- Drop old lottery/instant play tables
DROP TABLE IF EXISTS public.instant_play_history CASCADE;
DROP TABLE IF EXISTS public.instant_game_pool CASCADE;

-- Drop old daily drop tables
DROP TABLE IF EXISTS public.drop_entries CASCADE;
DROP TABLE IF EXISTS public.daily_drop_logs CASCADE;

-- =====================================================
-- PHASE 3: Clean Platform Config
-- Remove obsolete columns
-- =====================================================

ALTER TABLE public.platform_config 
DROP COLUMN IF EXISTS is_drop_active,
DROP COLUMN IF EXISTS drop_entry_fee,
DROP COLUMN IF EXISTS protected_percentage,
DROP COLUMN IF EXISTS beneficiary_percentage,
DROP COLUMN IF EXISTS minimum_pool_guarantee,
DROP COLUMN IF EXISTS instant_mode_enabled,
DROP COLUMN IF EXISTS instant_entry_fee,
DROP COLUMN IF EXISTS instant_pool_restock_threshold,
DROP COLUMN IF EXISTS instant_max_payout_limit,
DROP COLUMN IF EXISTS rigged_mode;

-- =====================================================
-- PHASE 4: Clean User Balances
-- Set all credits to 0 (safer than dropping column)
-- =====================================================

UPDATE public.user_balances 
SET credits_balance = 0 
WHERE credits_balance != 0;

-- =====================================================
-- PHASE 5: Clean Transaction Types Enum
-- Remove obsolete transaction types
-- Note: We cannot drop enum values in PostgreSQL, 
-- but we can document which are obsolete
-- =====================================================

-- The following transaction_type enum values are now obsolete:
-- 'drop_entry', 'drop_win', 'drop_refund', 'credit_redemption', 'voucher_issuance'
-- They will remain in the enum but should not be used going forward

-- =====================================================
-- PHASE 6: Clean Event Types Enum
-- Note: Same limitation, documenting obsolete values
-- =====================================================

-- The following event_type enum values are now obsolete:
-- 'winner_alert', 'refund_notice', 'distribution_failed'
-- They will remain in the enum but should not be used going forward

-- =====================================================
-- PHASE 7: Remove Obsolete Result Status Enum
-- This enum was only used for drops
-- =====================================================

-- Cannot drop enum type if still referenced anywhere
-- DROP TYPE IF EXISTS public.result_status CASCADE;

-- =====================================================
-- SUMMARY
-- =====================================================
-- Deleted Functions: 8 RPC functions
-- Deleted Tables: 4 tables (instant_game_pool, instant_play_history, drop_entries, daily_drop_logs)
-- Removed Columns: 10 columns from platform_config
-- Reset: All credits_balance to 0
-- =====================================================