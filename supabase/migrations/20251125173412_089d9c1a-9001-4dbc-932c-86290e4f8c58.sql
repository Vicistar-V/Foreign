-- =====================================================
-- GRANT ADMIN ROLE TO ADMIN USER
-- =====================================================
-- This migration assigns the 'admin' role to the Admin Vici user

INSERT INTO public.user_roles (user_id, role)
VALUES ('8a805ce2-70ce-4943-9a04-b4e35168c63d', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Verification: Check if the role was added
DO $$
DECLARE
  v_has_admin BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles 
    WHERE user_id = '8a805ce2-70ce-4943-9a04-b4e35168c63d' 
    AND role = 'admin'
  ) INTO v_has_admin;
  
  IF v_has_admin THEN
    RAISE NOTICE '✅ Admin role successfully granted to Admin Vici user';
  ELSE
    RAISE EXCEPTION '❌ Failed to grant admin role';
  END IF;
END $$;