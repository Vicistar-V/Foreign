
-- Reset legacy members who have no spots back to non-member status
-- These are users who were marked as members in the old system but never actually activated

UPDATE profiles
SET is_member = false
WHERE is_member = true
  AND NOT EXISTS (SELECT 1 FROM spots s WHERE s.user_id = profiles.id)
  AND id != '00000000-0000-0000-0000-000000000000'; -- Exclude SYSTEM_TREASURY

-- Add a comment explaining this migration
COMMENT ON TABLE profiles IS 'User profiles - is_member should only be true if user has at least one active spot';
