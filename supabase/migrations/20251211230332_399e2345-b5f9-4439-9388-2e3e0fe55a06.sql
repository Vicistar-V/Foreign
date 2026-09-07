-- Add account_unbanned event type for unban notifications
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'account_unbanned';