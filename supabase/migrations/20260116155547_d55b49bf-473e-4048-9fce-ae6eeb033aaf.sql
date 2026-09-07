
-- REVERSE FRAUDULENT REWARDS for Glo-mira Ekeng
-- User ID: 555c5251-85b4-4e3f-b9a6-e580a5ee3d3f
-- She submitted same screenshot 4 times for Friendly Reminder mission
-- 3 were approved and paid (₦50 x 3 = ₦150)
-- 1 is pending_review

-- Step 1: Reject the pending_review submission (has same duplicate hash)
UPDATE mission_completions 
SET 
  status = 'rejected',
  rejection_reason = 'Duplicate screenshot - same image submitted multiple times',
  reviewed_at = now()
WHERE id = '06252f55-9bab-44a5-9f42-06c9211834fa';

-- Step 2: Mark 2 of the 3 approved ones as rejected (keep 1 valid)
-- Keep: 80539df5-a80a-44c8-afa2-489194893042 (first approved one at 14:08)
-- Reject: 1699c31b-03e9-49f0-b885-3e88f7d50271 (at 14:25:26)
-- Reject: b496a487-5514-43b8-baa7-9392d14d37fd (at 14:25:21)

UPDATE mission_completions 
SET 
  status = 'rejected',
  rejection_reason = 'Reversed: Duplicate screenshot fraud - same image used multiple times',
  reviewed_at = now()
WHERE id IN ('1699c31b-03e9-49f0-b885-3e88f7d50271', 'b496a487-5514-43b8-baa7-9392d14d37fd');

-- Step 3: Create debt reversal transactions to claw back the ₦100 fraudulent rewards
-- (Keeping the original ₦50 as valid since she at least did submit once)
INSERT INTO transactions (user_id, amount, transaction_type, wallet_type, description, status)
VALUES 
  ('555c5251-85b4-4e3f-b9a6-e580a5ee3d3f', -50, 'debt_reversal', 'earnings', 'Reversed: Duplicate screenshot submission for Friendly Reminder', 'completed'),
  ('555c5251-85b4-4e3f-b9a6-e580a5ee3d3f', -50, 'debt_reversal', 'earnings', 'Reversed: Duplicate screenshot submission for Friendly Reminder', 'completed');

-- Step 4: Refresh user's cached balance
SELECT refresh_user_cache('555c5251-85b4-4e3f-b9a6-e580a5ee3d3f');

-- Step 5: Create notification to inform user
INSERT INTO notifications (user_id, notification_type, title, message)
VALUES (
  '555c5251-85b4-4e3f-b9a6-e580a5ee3d3f',
  'warning',
  'Task Rewards Reversed',
  'We detected that the same screenshot was submitted multiple times for the Friendly Reminder task. ₦100 has been deducted. Please submit unique screenshots for each task completion.'
);
