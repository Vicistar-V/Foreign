-- Add metadata column to drop_entries if it doesn't exist
ALTER TABLE public.drop_entries 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Add comment to explain new payment breakdown structure
COMMENT ON COLUMN public.drop_entries.metadata IS 'Stores payment breakdown from all three wallets: {"payment_breakdown": {"credits": number, "deposit": number, "earnings": number}}';

-- Add index on drop_date for faster distribution processing
CREATE INDEX IF NOT EXISTS idx_drop_entries_drop_date_status ON public.drop_entries(drop_date, result_status);