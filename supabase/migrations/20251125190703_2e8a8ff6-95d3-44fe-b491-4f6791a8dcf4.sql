-- Add 'admin_message' to event_type enum
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'admin_message';