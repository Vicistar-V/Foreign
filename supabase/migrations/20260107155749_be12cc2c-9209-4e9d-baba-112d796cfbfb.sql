-- Update handle_new_user function to create admin notification on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _referral_code text;
  _referred_by_code text;
  _full_name text;
BEGIN
  -- Extract metadata
  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'User');
  _referred_by_code := NEW.raw_user_meta_data->>'referred_by_code';
  
  -- Generate unique referral code
  _referral_code := upper(substr(md5(random()::text), 1, 8));
  
  -- Create user profile
  INSERT INTO public.profiles (
    id,
    full_name,
    referral_code,
    referred_by_code,
    phone_number
  ) VALUES (
    NEW.id,
    _full_name,
    _referral_code,
    _referred_by_code,
    NEW.raw_user_meta_data->>'phone_number'
  );
  
  -- Create admin notification for new signup
  INSERT INTO public.admin_notifications (
    notification_type,
    title,
    message,
    metadata,
    link
  ) VALUES (
    'new_signup',
    'New User Signed Up!',
    format('%s just signed up!', _full_name),
    jsonb_build_object(
      'user_id', NEW.id,
      'email', NEW.email,
      'full_name', _full_name,
      'referred_by', _referred_by_code
    ),
    '/admin/users'
  );
  
  RETURN NEW;
END;
$$;