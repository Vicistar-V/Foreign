
-- =====================================================================
-- STEP 3: Wrap auth.uid() in (SELECT auth.uid()) for per-statement caching
-- =====================================================================

-- profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING ((SELECT auth.uid()) = id);

-- transactions
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
CREATE POLICY "Users can view their own transactions" ON public.transactions
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- withdrawal_accounts
DROP POLICY IF EXISTS "Users can delete their own bank accounts" ON public.withdrawal_accounts;
CREATE POLICY "Users can delete their own bank accounts" ON public.withdrawal_accounts
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own bank accounts" ON public.withdrawal_accounts;
CREATE POLICY "Users can insert their own bank accounts" ON public.withdrawal_accounts
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own bank accounts" ON public.withdrawal_accounts;
CREATE POLICY "Users can update their own bank accounts" ON public.withdrawal_accounts
  FOR UPDATE USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own bank accounts" ON public.withdrawal_accounts;
CREATE POLICY "Users can view their own bank accounts" ON public.withdrawal_accounts
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- support_tickets
DROP POLICY IF EXISTS "Admins can update all tickets" ON public.support_tickets;
CREATE POLICY "Admins can update all tickets" ON public.support_tickets
  FOR UPDATE USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all tickets" ON public.support_tickets;
CREATE POLICY "Admins can view all tickets" ON public.support_tickets
  FOR SELECT USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can create their own tickets" ON public.support_tickets;
CREATE POLICY "Users can create their own tickets" ON public.support_tickets
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own tickets" ON public.support_tickets;
CREATE POLICY "Users can view their own tickets" ON public.support_tickets
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- ticket_messages
DROP POLICY IF EXISTS "Admins can insert messages" ON public.ticket_messages;
CREATE POLICY "Admins can insert messages" ON public.ticket_messages
  FOR INSERT WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update messages" ON public.ticket_messages;
CREATE POLICY "Admins can update messages" ON public.ticket_messages
  FOR UPDATE USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all messages" ON public.ticket_messages;
CREATE POLICY "Admins can view all messages" ON public.ticket_messages
  FOR SELECT USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can add messages to their tickets" ON public.ticket_messages;
CREATE POLICY "Users can add messages to their tickets" ON public.ticket_messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM support_tickets WHERE support_tickets.id = ticket_messages.ticket_id AND support_tickets.user_id = (SELECT auth.uid()))
    AND sender_type = 'user'::ticket_sender_type
    AND sender_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Users can only mark messages read on their tickets" ON public.ticket_messages;
CREATE POLICY "Users can only mark messages read on their tickets" ON public.ticket_messages
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM support_tickets WHERE support_tickets.id = ticket_messages.ticket_id AND support_tickets.user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM support_tickets WHERE support_tickets.id = ticket_messages.ticket_id AND support_tickets.user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Users can view messages on their tickets" ON public.ticket_messages;
CREATE POLICY "Users can view messages on their tickets" ON public.ticket_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM support_tickets WHERE support_tickets.id = ticket_messages.ticket_id AND support_tickets.user_id = (SELECT auth.uid()))
  );

-- user_activity_log
DROP POLICY IF EXISTS "Admins can view all activity" ON public.user_activity_log;
CREATE POLICY "Admins can view all activity" ON public.user_activity_log
  FOR SELECT USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can insert their own activity" ON public.user_activity_log;
CREATE POLICY "Users can insert their own activity" ON public.user_activity_log
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- platform_config
DROP POLICY IF EXISTS "Admins can update platform config" ON public.platform_config;
CREATE POLICY "Admins can update platform config" ON public.platform_config
  FOR UPDATE USING (has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view platform config" ON public.platform_config;
CREATE POLICY "Admins can view platform config" ON public.platform_config
  FOR SELECT USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- notifications
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- cached_balances
DROP POLICY IF EXISTS "Users can view their own cached balance" ON public.cached_balances;
CREATE POLICY "Users can view their own cached balance" ON public.cached_balances
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- drops
DROP POLICY IF EXISTS "Admins can view all drops" ON public.drops;
CREATE POLICY "Admins can view all drops" ON public.drops
  FOR SELECT USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view drops for their spots" ON public.drops;
CREATE POLICY "Users can view drops for their spots" ON public.drops
  FOR SELECT USING (EXISTS (SELECT 1 FROM spots WHERE spots.id = drops.spot_id AND spots.user_id = (SELECT auth.uid())));

-- spots
DROP POLICY IF EXISTS "Admins can view all spots" ON public.spots;
CREATE POLICY "Admins can view all spots" ON public.spots
  FOR SELECT USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view their own spots" ON public.spots;
CREATE POLICY "Users can view their own spots" ON public.spots
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- admin_notifications
DROP POLICY IF EXISTS "Admins can update admin notifications" ON public.admin_notifications;
CREATE POLICY "Admins can update admin notifications" ON public.admin_notifications
  FOR UPDATE USING (has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view admin notifications" ON public.admin_notifications;
CREATE POLICY "Admins can view admin notifications" ON public.admin_notifications
  FOR SELECT USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- comparison_broken_reports
DROP POLICY IF EXISTS "Admins view reports" ON public.comparison_broken_reports;
CREATE POLICY "Admins view reports" ON public.comparison_broken_reports
  FOR SELECT USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Users insert own reports" ON public.comparison_broken_reports;
CREATE POLICY "Users insert own reports" ON public.comparison_broken_reports
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = reporter_id);

DROP POLICY IF EXISTS "Users view own reports" ON public.comparison_broken_reports;
CREATE POLICY "Users view own reports" ON public.comparison_broken_reports
  FOR SELECT USING ((SELECT auth.uid()) = reporter_id);

-- comparison_categories
DROP POLICY IF EXISTS "Admins manage categories" ON public.comparison_categories;
CREATE POLICY "Admins manage categories" ON public.comparison_categories
  FOR ALL USING (has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can view active categories" ON public.comparison_categories;
CREATE POLICY "Anyone can view active categories" ON public.comparison_categories
  FOR SELECT USING ((is_active = true) OR has_role((SELECT auth.uid()), 'admin'::app_role));

-- comparison_images
DROP POLICY IF EXISTS "Admins manage images" ON public.comparison_images;
CREATE POLICY "Admins manage images" ON public.comparison_images
  FOR ALL USING (has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can view live images" ON public.comparison_images;
CREATE POLICY "Anyone can view live images" ON public.comparison_images
  FOR SELECT USING ((is_dead = false) OR has_role((SELECT auth.uid()), 'admin'::app_role));

-- comparison_seen_log
DROP POLICY IF EXISTS "Users insert own seen log" ON public.comparison_seen_log;
CREATE POLICY "Users insert own seen log" ON public.comparison_seen_log
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users view own seen log" ON public.comparison_seen_log;
CREATE POLICY "Users view own seen log" ON public.comparison_seen_log
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- daily_task
DROP POLICY IF EXISTS "Admins can view all daily tasks" ON public.daily_task;
CREATE POLICY "Admins can view all daily tasks" ON public.daily_task
  FOR SELECT USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view their own daily task" ON public.daily_task;
CREATE POLICY "Users can view their own daily task" ON public.daily_task
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- drop_fill_audit_log
DROP POLICY IF EXISTS "Admins can view fill audit log" ON public.drop_fill_audit_log;
CREATE POLICY "Admins can view fill audit log" ON public.drop_fill_audit_log
  FOR SELECT USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- drop_pulses
DROP POLICY IF EXISTS "Admins can view pulse history" ON public.drop_pulses;
CREATE POLICY "Admins can view pulse history" ON public.drop_pulses
  FOR SELECT USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- harvest_warnings
DROP POLICY IF EXISTS "Users view their own harvest warnings" ON public.harvest_warnings;
CREATE POLICY "Users view their own harvest warnings" ON public.harvest_warnings
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- payment_attempts
DROP POLICY IF EXISTS "Admins can view all payment attempts" ON public.payment_attempts;
CREATE POLICY "Admins can view all payment attempts" ON public.payment_attempts
  FOR SELECT USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view their own payment attempts" ON public.payment_attempts;
CREATE POLICY "Users can view their own payment attempts" ON public.payment_attempts
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- referral_bonus_grants
DROP POLICY IF EXISTS "Admins can view all bonus grants" ON public.referral_bonus_grants;
CREATE POLICY "Admins can view all bonus grants" ON public.referral_bonus_grants
  FOR SELECT USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view their own bonus grants as referrer" ON public.referral_bonus_grants;
CREATE POLICY "Users can view their own bonus grants as referrer" ON public.referral_bonus_grants
  FOR SELECT USING ((SELECT auth.uid()) = referrer_id);

-- system_alerts
DROP POLICY IF EXISTS "Admins can acknowledge alerts" ON public.system_alerts;
CREATE POLICY "Admins can acknowledge alerts" ON public.system_alerts
  FOR UPDATE USING (has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all system alerts" ON public.system_alerts;
CREATE POLICY "Admins can view all system alerts" ON public.system_alerts
  FOR SELECT USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- unmatched_moniepoint_payments
DROP POLICY IF EXISTS "Admins update unmatched payments" ON public.unmatched_moniepoint_payments;
CREATE POLICY "Admins update unmatched payments" ON public.unmatched_moniepoint_payments
  FOR UPDATE USING (has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins view unmatched payments" ON public.unmatched_moniepoint_payments;
CREATE POLICY "Admins view unmatched payments" ON public.unmatched_moniepoint_payments
  FOR SELECT USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- user_roles
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- user_tour_progress
DROP POLICY IF EXISTS "Admins view all tour progress" ON public.user_tour_progress;
CREATE POLICY "Admins view all tour progress" ON public.user_tour_progress
  FOR SELECT USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Users view own tour progress" ON public.user_tour_progress;
CREATE POLICY "Users view own tour progress" ON public.user_tour_progress
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- webhook_logs
DROP POLICY IF EXISTS "Admins can view webhook logs" ON public.webhook_logs;
CREATE POLICY "Admins can view webhook logs" ON public.webhook_logs
  FOR SELECT USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- =====================================================================
-- STEP 4: Add missing FK indexes + drop duplicate index
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_support_tickets_resolved_by
  ON public.support_tickets(resolved_by);

CREATE INDEX IF NOT EXISTS idx_system_alerts_acknowledged_by
  ON public.system_alerts(acknowledged_by);

-- Drop duplicate unique index (same columns as the _key index)
DROP INDEX IF EXISTS public.comparison_broken_reports_unique;
