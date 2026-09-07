-- Fix: Remove the extra ₦1,000 incorrectly added to Chiemerie's drop (position 31)
UPDATE drops 
SET fill_amount = 0, 
    status = 'waiting'
WHERE position = 31 
AND status = 'filling';