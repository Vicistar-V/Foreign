-- Add action_url column for storing the "Go Do It" link (WhatsApp group, Telegram channel, etc.)
ALTER TABLE missions ADD COLUMN IF NOT EXISTS action_url TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN missions.action_url IS 'The link users click to go do the task (e.g., WhatsApp group invite, Telegram channel, Facebook page)';