-- =====================================================
-- FIX QUEUE: Remove duplicates and prioritize new people
-- =====================================================

-- Step 1: Delete duplicate waiting drops (keep only the earliest one per spot)
DELETE FROM drops 
WHERE id IN (
  SELECT id FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (PARTITION BY spot_id ORDER BY created_at ASC) as rn
    FROM drops 
    WHERE status = 'waiting'
  ) duplicates
  WHERE rn > 1
);

-- Step 2: Reorder waiting drops - NEW people first (never paid), VETERANS last
WITH reordered AS (
  SELECT 
    d.id,
    1 + ROW_NUMBER() OVER (
      ORDER BY 
        CASE WHEN s.total_cycles = 0 THEN 0 ELSE 1 END ASC,
        d.created_at ASC
    ) as new_position
  FROM drops d
  JOIN spots s ON d.spot_id = s.id
  WHERE d.status = 'waiting'
)
UPDATE drops
SET position = reordered.new_position
FROM reordered
WHERE drops.id = reordered.id;