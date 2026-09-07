
-- Delete Adefisayo's last transaction (₦900 drop_profit)
DELETE FROM transactions 
WHERE id = '307a3a81-4e30-4d01-91c4-514890652d48';

-- Reset the half-filled drop (position 534, Machine 2) to zero
UPDATE drops 
SET fill_amount = 0, status = 'waiting'
WHERE id = 'd7f18312-cc64-4d0c-b3e0-c3c681503c6a';

-- Refresh Adefisayo's cache
SELECT refresh_user_cache('647b68e1-7a74-4f8a-8232-ad7d3f152705');
