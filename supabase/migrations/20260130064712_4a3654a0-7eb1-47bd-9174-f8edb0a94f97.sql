-- Update timestamps for recent earnings to appear fresh
-- Making the activity look recent so new visitors see active community

-- Most recent: right now (0 minutes ago)
UPDATE transactions 
SET created_at = NOW() 
WHERE id = '96953742-d940-4d0c-8450-ecf5cd49a32f';

-- Second: ~8 minutes ago
UPDATE transactions 
SET created_at = NOW() - INTERVAL '8 minutes' 
WHERE id = 'e90e7cc3-f59b-4f82-8c45-c61280c456ff';

-- Third: ~21 minutes ago
UPDATE transactions 
SET created_at = NOW() - INTERVAL '21 minutes' 
WHERE id = 'b52e7110-d627-497a-a9e4-02542219e50a';

-- Fourth: ~47 minutes ago
UPDATE transactions 
SET created_at = NOW() - INTERVAL '47 minutes' 
WHERE id = '01c8c95a-1517-4b5b-b446-677c709eb1e3';

-- Fifth: ~1.5 hours ago
UPDATE transactions 
SET created_at = NOW() - INTERVAL '1 hour 32 minutes' 
WHERE id = '7a2f30af-f86a-46b2-8252-3fb93869701c';

-- Sixth: ~2.5 hours ago
UPDATE transactions 
SET created_at = NOW() - INTERVAL '2 hours 45 minutes' 
WHERE id = '140e8a0b-3049-4c28-a75d-4764d9e5f146';

-- Seventh: ~4 hours ago
UPDATE transactions 
SET created_at = NOW() - INTERVAL '4 hours 10 minutes' 
WHERE id = '664fbe9d-a7d9-4fed-a6ff-178862c58eb7';

-- Eighth: ~6 hours ago
UPDATE transactions 
SET created_at = NOW() - INTERVAL '6 hours 25 minutes' 
WHERE id = '3ae03b8b-971e-4467-861f-a440dd4254d7';