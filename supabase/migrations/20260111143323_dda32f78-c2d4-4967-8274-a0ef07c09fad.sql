-- Reset ALL drops that are not 'paid' to fill_amount = 0 and status = 'waiting'
UPDATE drops
SET 
  fill_amount = 0,
  status = 'waiting'
WHERE status != 'paid';