-- Reset total_recycled_profit for all users
UPDATE profiles 
SET total_recycled_profit = 0
WHERE total_recycled_profit > 0;