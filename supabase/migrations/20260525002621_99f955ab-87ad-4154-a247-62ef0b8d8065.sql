
-- Create a system user in auth.users for platform-side ledger entries (withdrawal fees, etc.)
-- Uses fixed UUID 00000000-0000-0000-0000-000000000000 referenced by existing RPCs
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, is_sso_user, is_anonymous
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'service_account',
  'system@viketa.internal',
  '',
  now(), now(), now(),
  '{"provider":"system","providers":["system"]}'::jsonb,
  '{"system":true}'::jsonb,
  false, false, false
)
ON CONFLICT (id) DO NOTHING;

-- Mirror profile (profiles.id has FK to auth.users)
INSERT INTO public.profiles (id, full_name, referral_code)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Platform System',
  'SYSTEM'
)
ON CONFLICT (id) DO NOTHING;
