-- Add transactions and notifications to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Also ensure REPLICA IDENTITY FULL for better change tracking
ALTER TABLE transactions REPLICA IDENTITY FULL;
ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER TABLE drops REPLICA IDENTITY FULL;
ALTER TABLE spots REPLICA IDENTITY FULL;