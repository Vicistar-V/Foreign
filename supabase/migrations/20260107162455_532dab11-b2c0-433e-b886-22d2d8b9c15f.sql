-- Backfill: Fix Vivian's membership status (and any other affected users)
UPDATE profiles 
SET is_member = true 
WHERE id IN (
  SELECT DISTINCT s.user_id 
  FROM spots s 
  WHERE s.user_id IN (
    SELECT id FROM profiles WHERE is_member = false
  )
);

-- This catches anyone who has a spot but is_member = false