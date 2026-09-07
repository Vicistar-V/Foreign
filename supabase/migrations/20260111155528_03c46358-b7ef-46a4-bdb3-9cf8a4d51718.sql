-- Delete Victor Chiemerie's Machine 6 (latest spot) and its drops
DELETE FROM drops WHERE spot_id = '6c79e6fc-ea67-4ce3-9c5d-c720ac015cf7';
DELETE FROM spots WHERE id = '6c79e6fc-ea67-4ce3-9c5d-c720ac015cf7';

-- Reset the current filling drop (position 533) from 1900 to 0
UPDATE drops 
SET fill_amount = 0, status = 'waiting'
WHERE id = '86c02c9f-8b10-4cac-b26d-8b34b9cd7277';

-- Refresh Victor's cache
SELECT refresh_user_cache('b23d5dd6-3f5d-49a7-8ad9-62a1feb17dc2');