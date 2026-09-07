-- Delete non-admin Victor Ogazie user (15980d55-ca66-44f9-b8e2-6fb26fa74179)
-- This cascades to profiles and all related data

-- First delete from auth.users (this cascades to profiles due to ON DELETE CASCADE)
DELETE FROM auth.users WHERE id = '15980d55-ca66-44f9-b8e2-6fb26fa74179';