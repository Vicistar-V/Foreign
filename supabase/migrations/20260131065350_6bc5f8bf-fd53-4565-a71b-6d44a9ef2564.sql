-- Add leaderboard_prize to transaction_type enum
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'leaderboard_prize';