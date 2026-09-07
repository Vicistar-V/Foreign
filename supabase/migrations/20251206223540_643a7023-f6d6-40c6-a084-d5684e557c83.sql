-- Add Victor Ogazie as admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('5d7a5ea2-034c-4665-86b6-816d81dc0330', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;