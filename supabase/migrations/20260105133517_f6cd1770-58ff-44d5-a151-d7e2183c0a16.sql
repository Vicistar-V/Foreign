-- =====================================================
-- COMPLETE NOTIFICATION SYSTEM REBUILD
-- Creates dedicated notifications tables without enum constraints
-- =====================================================

-- 1. Create the main notifications table for users
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,  -- TEXT, not enum - any type allowed!
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  link TEXT,  -- Optional navigation route
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
  ON public.notifications(user_id, created_at DESC) 
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_type 
  ON public.notifications(notification_type);

-- 2. Create admin_notifications table for admin-specific alerts
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT NOT NULL,  -- TEXT, not enum
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  link TEXT,  -- Optional navigation route
  read_by JSONB DEFAULT '[]',  -- Array of admin user IDs who read it
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for admin notifications
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created 
  ON public.admin_notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_type 
  ON public.admin_notifications(notification_type);

-- 3. Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for notifications table
-- Users can only view their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can insert notifications
CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Service role can manage all notifications
CREATE POLICY "Service role can manage all notifications"
  ON public.notifications FOR ALL
  USING (auth.role() = 'service_role');

-- 5. Create RLS policies for admin_notifications table
-- Only admins can view admin notifications
CREATE POLICY "Admins can view admin notifications"
  ON public.admin_notifications FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can update admin notifications
CREATE POLICY "Admins can update admin notifications"
  ON public.admin_notifications FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Service role can insert admin notifications
CREATE POLICY "Service role can insert admin notifications"
  ON public.admin_notifications FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Service role can manage all admin notifications
CREATE POLICY "Service role can manage all admin notifications"
  ON public.admin_notifications FOR ALL
  USING (auth.role() = 'service_role');

-- 6. Create a helper function to create user notifications
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id UUID,
  _type TEXT,
  _title TEXT,
  _message TEXT,
  _metadata JSONB DEFAULT '{}',
  _link TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id, notification_type, title, message, metadata, link
  ) VALUES (
    _user_id, _type, _title, _message, _metadata, _link
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- 7. Create a helper function to create admin notifications
CREATE OR REPLACE FUNCTION public.create_admin_notification(
  _type TEXT,
  _title TEXT,
  _message TEXT,
  _metadata JSONB DEFAULT '{}',
  _link TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.admin_notifications (
    notification_type, title, message, metadata, link
  ) VALUES (
    _type, _title, _message, _metadata, _link
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;