-- Add read tracking column to transactions table for notification system
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for faster notification queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_notification_read 
ON public.transactions(user_id, transaction_type, read_at, created_at DESC) 
WHERE transaction_type IN ('membership_bonus', 'deposit');