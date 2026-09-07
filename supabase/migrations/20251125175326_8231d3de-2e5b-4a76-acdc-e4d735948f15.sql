-- =====================================================
-- ADD NEW EVENT TYPES FOR CHARGEBACK SYSTEM
-- =====================================================

-- Add 'chargeback_alert' event type (for referrer notifications)
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'chargeback_alert';

-- Add 'account_banned' event type (for banned user notifications)
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'account_banned';

-- Note: These new event types will enable proper notification handling for:
-- 1. chargeback_alert: Notifies referrer when their commission is reversed due to chargeback
-- 2. account_banned: Notifies the banned user about their account suspension