
-- =====================================================
-- QUEUE POSITION RESET: Renumber from 1
-- =====================================================
-- Current: positions 558-659 (from testing)
-- After: positions 1-102 (clean sequential numbering)
-- =====================================================

WITH renumbered AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (ORDER BY position ASC) as new_position
  FROM drops
  WHERE status = 'waiting'
)
UPDATE drops
SET position = renumbered.new_position
FROM renumbered
WHERE drops.id = renumbered.id;
