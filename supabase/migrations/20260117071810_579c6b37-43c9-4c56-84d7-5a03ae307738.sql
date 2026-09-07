-- =====================================================
-- QUEUE POSITION RESET: Clean numbering system
-- =====================================================
-- Paid drops = position 0 (they're done)
-- Filling drop = position 1 (front of line)
-- Waiting drops = positions 2+ (in queue order)
-- =====================================================

-- Step 1: Set all PAID drops to position 0 (they're finished)
UPDATE drops SET position = 0 WHERE status = 'paid';

-- Step 2: Set FILLING drop to position 1 (front of line)
UPDATE drops SET position = 1 WHERE status = 'filling';

-- Step 3: Renumber WAITING drops starting from position 2
WITH waiting_ordered AS (
  SELECT 
    id,
    1 + ROW_NUMBER() OVER (ORDER BY position ASC) as new_position
  FROM drops
  WHERE status = 'waiting'
)
UPDATE drops
SET position = waiting_ordered.new_position
FROM waiting_ordered
WHERE drops.id = waiting_ordered.id;