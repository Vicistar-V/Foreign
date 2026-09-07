-- ============================================
-- CLEANUP: Remove Unused Database Functions
-- These RPCs are no longer called from any edge function or frontend
-- ============================================

-- Distribution-related (replaced by Edge Function)
DROP FUNCTION IF EXISTS public.distribute_liquidity(numeric, uuid, integer);
DROP FUNCTION IF EXISTS public.call_distribute_liquidity_edge(numeric, uuid, integer);
DROP FUNCTION IF EXISTS public.commit_distribution_batch(json);

-- Pulse/Processing functions (never used)
DROP FUNCTION IF EXISTS public.process_drop_pulse();
DROP FUNCTION IF EXISTS public.process_reentry_pulse();
DROP FUNCTION IF EXISTS public.process_genesis_completion(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.process_single_reentry(uuid, integer, numeric, uuid, text, uuid);

-- Payment functions (logic now in Edge Function)
DROP FUNCTION IF EXISTS public.pay_genesis_yield(numeric, boolean, uuid, uuid);
DROP FUNCTION IF EXISTS public.pay_admin_fee(numeric, uuid, uuid);
DROP FUNCTION IF EXISTS public.pay_admin_fee(numeric, uuid, uuid, boolean);
DROP FUNCTION IF EXISTS public.pay_user_profit(boolean, numeric, uuid, uuid);
DROP FUNCTION IF EXISTS public.pay_referral_bonus(numeric, uuid, text);
DROP FUNCTION IF EXISTS public.pay_first_cycle_referral_bonus(uuid, text);

-- Auto-compound functions (never used)
DROP FUNCTION IF EXISTS public.try_auto_buy_machine(uuid);
DROP FUNCTION IF EXISTS public.process_auto_compound(uuid, text);

-- Data getter functions (unused)
DROP FUNCTION IF EXISTS public.get_spot_creation_data(wallet_type, uuid);
DROP FUNCTION IF EXISTS public.get_reentry_data();
DROP FUNCTION IF EXISTS public.get_unsettled_reentries();
DROP FUNCTION IF EXISTS public.get_next_drop_position();

-- Notification functions (replaced by direct inserts)
DROP FUNCTION IF EXISTS public.notify_reentry_processed(integer, text, uuid);
DROP FUNCTION IF EXISTS public.send_overflow_notification(numeric, uuid);
DROP FUNCTION IF EXISTS public.send_payout_notification(boolean, numeric, uuid);

-- Other unused functions
DROP FUNCTION IF EXISTS public.create_reentry_drop(uuid);
DROP FUNCTION IF EXISTS public.update_spot_stats(numeric, uuid);
DROP FUNCTION IF EXISTS public.mark_drop_settled(uuid);
DROP FUNCTION IF EXISTS public.mark_first_cycle_done(text, uuid);