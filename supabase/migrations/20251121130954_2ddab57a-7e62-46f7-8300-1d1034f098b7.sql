-- Add 'membership_fee' to transaction_type enum
-- This is needed to track membership payments that go to SYSTEM_TREASURY

ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'membership_fee';