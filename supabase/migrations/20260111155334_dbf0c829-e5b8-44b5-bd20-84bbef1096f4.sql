-- Delete all transactions after 6 AM today (2026-01-11)
DELETE FROM transactions 
WHERE created_at > '2026-01-11 06:00:00+00';

-- Refresh all user caches to reflect correct balances
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT DISTINCT id FROM profiles
    LOOP
        PERFORM refresh_user_cache(user_record.id);
    END LOOP;
END $$;