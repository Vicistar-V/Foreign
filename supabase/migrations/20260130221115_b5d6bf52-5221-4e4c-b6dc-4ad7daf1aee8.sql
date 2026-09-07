-- Refresh timestamps for recent earnings to appear fresh again

-- Most recent: right now
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

-- Also refresh drops paid_at timestamps

UPDATE drops 
SET paid_at = NOW(), created_at = NOW() - INTERVAL '2 hours'
WHERE id = '6ec673e3-2750-4169-a2f6-11189f60e4f9';

UPDATE drops 
SET paid_at = NOW() - INTERVAL '8 minutes', created_at = NOW() - INTERVAL '3 hours'
WHERE id = '50817ee6-e233-4e49-9337-0e453d0ed079';

UPDATE drops 
SET paid_at = NOW() - INTERVAL '21 minutes', created_at = NOW() - INTERVAL '4 hours'
WHERE id = '5f5a3e98-bfa7-44ea-9b67-e5ea9e296536';

UPDATE drops 
SET paid_at = NOW() - INTERVAL '47 minutes', created_at = NOW() - INTERVAL '5 hours'
WHERE id = '746c8f10-6859-4b45-8cff-d78874223136';

UPDATE drops 
SET paid_at = NOW() - INTERVAL '1 hour 32 minutes', created_at = NOW() - INTERVAL '6 hours'
WHERE id = '75155f45-5d3c-4588-85e3-ef213f50167f';

UPDATE drops 
SET paid_at = NOW() - INTERVAL '2 hours 45 minutes', created_at = NOW() - INTERVAL '8 hours'
WHERE id = 'eed5436c-a0a2-4e84-b822-1511fe31e2c5';

UPDATE drops 
SET paid_at = NOW() - INTERVAL '4 hours 10 minutes', created_at = NOW() - INTERVAL '10 hours'
WHERE id = '261d023e-7e8d-4d31-b57f-fab0cc3d4d0d';

UPDATE drops 
SET paid_at = NOW() - INTERVAL '6 hours 25 minutes', created_at = NOW() - INTERVAL '12 hours'
WHERE id = '5cd02a74-6d09-49dc-b9f8-909e1e9723cf';