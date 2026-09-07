-- =====================================================
-- ADD MISSING EVENT TYPES FOR ADMIN ALERTING SYSTEM
-- =====================================================
-- These event types are used by sendCriticalAlert() helper
-- to queue admin notifications for critical system failures

ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'distribution_failed';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'withdrawal_failed';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'system_critical_error';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'chargeback_detected';