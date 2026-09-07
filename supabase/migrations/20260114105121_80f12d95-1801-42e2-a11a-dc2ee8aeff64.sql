
-- Transfer membership and spot from Abdulraheem Tajudeen to Abdul Azeez Mujaahida Olamide

-- 1. Remove membership from wrong user (Abdulraheem Tajudeen)
UPDATE profiles
SET is_member = false, is_name_locked = false
WHERE id = '7f6d2e9a-0fc7-47bb-9563-8cb6c83b0254';

-- 2. Give membership to correct user (Abdul Azeez Mujaahida Olamide)
UPDATE profiles
SET is_member = true, is_name_locked = true
WHERE id = '1915770c-f55e-4809-92c6-e05776c50c03';

-- 3. Transfer the spot ownership to the correct user
UPDATE spots
SET user_id = '1915770c-f55e-4809-92c6-e05776c50c03'
WHERE user_id = '7f6d2e9a-0fc7-47bb-9563-8cb6c83b0254';

-- 4. Update any transactions related to membership_fee to correct user
UPDATE transactions
SET user_id = '1915770c-f55e-4809-92c6-e05776c50c03'
WHERE user_id = '7f6d2e9a-0fc7-47bb-9563-8cb6c83b0254'
AND transaction_type = 'membership_fee';

-- 5. Update cached balances - delete old user's cache so it rebuilds
DELETE FROM cached_balances WHERE user_id = '7f6d2e9a-0fc7-47bb-9563-8cb6c83b0254';

-- 6. Refresh cache for correct user
SELECT refresh_user_cache('1915770c-f55e-4809-92c6-e05776c50c03');
