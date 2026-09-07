INSERT INTO public.user_roles (user_id, role)
VALUES ('545f631e-40fd-4cba-a718-bd8d9c811e2b', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.platform_config SET minimum_withdrawal = 5000, updated_at = now() WHERE id = 1;