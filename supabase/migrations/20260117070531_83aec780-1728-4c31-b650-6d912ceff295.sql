
-- =====================================================
-- QUEUE REORGANIZATION: New Members to Front
-- =====================================================
-- This reorganizes the waiting queue to prioritize new members
-- who have NEVER received a payout over those who already have.
-- 
-- BEFORE: Old members (Victor, Vivian, etc with 5+ cycles) at front
-- AFTER: New members (joined recently, 0 cycles) at front
-- =====================================================

-- Step 1: Update NEW members (never paid, total_cycles = 0) to front positions (558-607)
-- Ordered by when they joined (oldest new member first)
WITH new_members_ordered AS (
  SELECT 
    d.id as drop_id,
    (557 + ROW_NUMBER() OVER (ORDER BY p.created_at ASC)) as new_position
  FROM drops d
  JOIN spots s ON d.spot_id = s.id
  JOIN profiles p ON s.user_id = p.id
  WHERE d.status = 'waiting'
    AND s.total_cycles = 0
)
UPDATE drops
SET position = new_members_ordered.new_position
FROM new_members_ordered
WHERE drops.id = new_members_ordered.drop_id;

-- Step 2: Update OLD members (paid 1+ times) to back positions (608-659)
-- Ordered by cycles (fewest cycles first, then oldest first)
WITH old_members_ordered AS (
  SELECT 
    d.id as drop_id,
    (607 + ROW_NUMBER() OVER (ORDER BY s.total_cycles ASC, p.created_at ASC)) as new_position
  FROM drops d
  JOIN spots s ON d.spot_id = s.id
  JOIN profiles p ON s.user_id = p.id
  WHERE d.status = 'waiting'
    AND s.total_cycles >= 1
)
UPDATE drops
SET position = old_members_ordered.new_position
FROM old_members_ordered
WHERE drops.id = old_members_ordered.drop_id;
