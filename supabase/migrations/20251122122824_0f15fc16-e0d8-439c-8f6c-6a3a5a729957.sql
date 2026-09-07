-- Add Victor Ogazie as admin
INSERT INTO public.user_roles (user_id, role) 
VALUES ('ba3b7ffc-2447-4924-803a-6f2869156632', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;