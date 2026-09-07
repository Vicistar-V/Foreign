
-- Update users referred by Victor Ogazie to be referred by Victor Chiemerie
UPDATE profiles
SET referred_by_code = 'victorchiemerie'
WHERE referred_by_code = 'victorogazie';
