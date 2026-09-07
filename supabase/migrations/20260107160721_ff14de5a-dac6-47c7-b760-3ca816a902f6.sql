-- Fix: Allow database triggers (running as postgres) to insert admin notifications
CREATE POLICY "Database triggers can insert admin notifications"
ON public.admin_notifications
FOR INSERT
TO postgres
WITH CHECK (true);

-- Backfill: Create notifications for recent signups that were missed
INSERT INTO public.admin_notifications (
  notification_type,
  title,
  message,
  metadata,
  link,
  created_at
)
SELECT 
  'new_signup',
  'New User Signed Up!',
  format('%s just signed up!', COALESCE(p.full_name, 'User')),
  jsonb_build_object(
    'user_id', p.id,
    'email', u.email,
    'full_name', p.full_name,
    'referred_by', p.referred_by_code
  ),
  '/admin/users',
  u.created_at
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE u.created_at >= '2026-01-07'::date
ORDER BY u.created_at;