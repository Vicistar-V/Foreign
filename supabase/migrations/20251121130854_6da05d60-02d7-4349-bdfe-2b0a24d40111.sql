-- Add metadata column to transactions table for tracking original user in system transactions
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add index for faster metadata queries
CREATE INDEX IF NOT EXISTS idx_transactions_metadata ON public.transactions USING GIN (metadata);

-- Add comment explaining the column
COMMENT ON COLUMN public.transactions.metadata IS 'Stores additional transaction context like original_user_id when payment goes to SYSTEM_TREASURY';