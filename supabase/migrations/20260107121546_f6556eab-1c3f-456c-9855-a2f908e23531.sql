-- Disconnect Victor Chiemerie from being referred by Victor Ogazie
UPDATE profiles 
SET referred_by_code = NULL 
WHERE id = 'b23d5dd6-3f5d-49a7-8ad9-62a1feb17dc2';