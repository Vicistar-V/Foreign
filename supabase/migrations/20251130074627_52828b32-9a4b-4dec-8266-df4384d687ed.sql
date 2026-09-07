-- Add 'skipped' status to event_status enum for when emails are disabled
-- This status means: "Email sending was turned off, so we didn't send it"
ALTER TYPE event_status ADD VALUE IF NOT EXISTS 'skipped';

COMMENT ON TYPE event_status IS 'Status of notification events: pending (waiting), processing (sending now), completed (sent successfully), failed (error occurred), skipped (emails disabled)';
