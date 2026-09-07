-- Update drops paid_at timestamps to appear fresh

-- Most recent drop: right now
UPDATE drops 
SET paid_at = NOW(), created_at = NOW() - INTERVAL '2 hours'
WHERE id = '6ec673e3-2750-4169-a2f6-11189f60e4f9';

-- Second drop: ~8 minutes ago
UPDATE drops 
SET paid_at = NOW() - INTERVAL '8 minutes', created_at = NOW() - INTERVAL '3 hours'
WHERE id = '50817ee6-e233-4e49-9337-0e453d0ed079';

-- Third drop: ~21 minutes ago
UPDATE drops 
SET paid_at = NOW() - INTERVAL '21 minutes', created_at = NOW() - INTERVAL '4 hours'
WHERE id = '5f5a3e98-bfa7-44ea-9b67-e5ea9e296536';

-- Fourth drop: ~47 minutes ago
UPDATE drops 
SET paid_at = NOW() - INTERVAL '47 minutes', created_at = NOW() - INTERVAL '5 hours'
WHERE id = '746c8f10-6859-4b45-8cff-d78874223136';

-- Fifth drop: ~1.5 hours ago
UPDATE drops 
SET paid_at = NOW() - INTERVAL '1 hour 32 minutes', created_at = NOW() - INTERVAL '6 hours'
WHERE id = '75155f45-5d3c-4588-85e3-ef213f50167f';

-- Sixth drop: ~2.5 hours ago
UPDATE drops 
SET paid_at = NOW() - INTERVAL '2 hours 45 minutes', created_at = NOW() - INTERVAL '8 hours'
WHERE id = 'eed5436c-a0a2-4e84-b822-1511fe31e2c5';

-- Seventh drop: ~4 hours ago
UPDATE drops 
SET paid_at = NOW() - INTERVAL '4 hours 10 minutes', created_at = NOW() - INTERVAL '10 hours'
WHERE id = '261d023e-7e8d-4d31-b57f-fab0cc3d4d0d';

-- Eighth drop: ~6 hours ago
UPDATE drops 
SET paid_at = NOW() - INTERVAL '6 hours 25 minutes', created_at = NOW() - INTERVAL '12 hours'
WHERE id = '5cd02a74-6d09-49dc-b9f8-909e1e9723cf';