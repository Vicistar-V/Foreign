-- Delete non-admin Victor Ogazie and all related data
-- Must delete in correct order due to FK constraints and triggers

DO $$
DECLARE
  v_user_id UUID := '15980d55-ca66-44f9-b8e2-6fb26fa74179';
BEGIN
  -- 1. Delete cached balances first (has FK to profiles)
  DELETE FROM cached_balances WHERE user_id = v_user_id;
  
  -- 2. Delete drops (has FK to spots)
  DELETE FROM drops WHERE spot_id IN (SELECT id FROM spots WHERE user_id = v_user_id);
  
  -- 3. Delete spots
  DELETE FROM spots WHERE user_id = v_user_id;
  
  -- 4. Delete transactions
  DELETE FROM transactions WHERE user_id = v_user_id;
  
  -- 5. Delete notifications
  DELETE FROM notifications WHERE user_id = v_user_id;
  
  -- 6. Delete payment attempts
  DELETE FROM payment_attempts WHERE user_id = v_user_id;
  
  -- 7. Delete ticket messages (has FK to tickets)
  DELETE FROM ticket_messages WHERE sender_id = v_user_id;
  DELETE FROM ticket_messages WHERE ticket_id IN (SELECT id FROM support_tickets WHERE user_id = v_user_id);
  
  -- 8. Delete support tickets
  DELETE FROM support_tickets WHERE user_id = v_user_id;
  
  -- 9. Delete withdrawal accounts
  DELETE FROM withdrawal_accounts WHERE user_id = v_user_id;
  
  -- 10. Delete user roles
  DELETE FROM user_roles WHERE user_id = v_user_id;
  
  -- 11. Delete activity log
  DELETE FROM user_activity_log WHERE user_id = v_user_id;
  
  -- 12. Finally delete the profile
  DELETE FROM profiles WHERE id = v_user_id;
  
  RAISE NOTICE 'Successfully deleted user % and all related data', v_user_id;
END $$;