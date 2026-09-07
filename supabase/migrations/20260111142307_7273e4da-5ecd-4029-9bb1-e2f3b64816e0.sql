-- Fix position 36 target_amount
UPDATE drops SET target_amount = 2000 WHERE position = 36 AND target_amount = 1500;