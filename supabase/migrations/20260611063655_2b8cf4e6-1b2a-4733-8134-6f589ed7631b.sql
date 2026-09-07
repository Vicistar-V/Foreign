
-- Add year and month of birth to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_year integer,
  ADD COLUMN IF NOT EXISTS birth_month integer;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_birth_year_check CHECK (birth_year IS NULL OR (birth_year BETWEEN 1900 AND 2100)),
  ADD CONSTRAINT profiles_birth_month_check CHECK (birth_month IS NULL OR (birth_month BETWEEN 1 AND 12));

-- Update handle_new_user to capture birth_year / birth_month from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _referral_code text;
  _referred_by_code text;
  _full_name text;
  _birth_year int;
  _birth_month int;
BEGIN
  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'User');
  _referred_by_code := LOWER(NEW.raw_user_meta_data->>'referred_by_code');

  BEGIN
    _birth_year := NULLIF(NEW.raw_user_meta_data->>'birth_year', '')::int;
  EXCEPTION WHEN OTHERS THEN _birth_year := NULL; END;

  BEGIN
    _birth_month := NULLIF(NEW.raw_user_meta_data->>'birth_month', '')::int;
  EXCEPTION WHEN OTHERS THEN _birth_month := NULL; END;

  _referral_code := upper(substr(md5(random()::text), 1, 8));

  INSERT INTO public.profiles (
    id, full_name, referral_code, referred_by_code, phone_number, birth_year, birth_month
  ) VALUES (
    NEW.id, _full_name, _referral_code, _referred_by_code,
    NEW.raw_user_meta_data->>'phone_number', _birth_year, _birth_month
  );

  INSERT INTO public.admin_notifications (
    notification_type, title, message, metadata, link
  ) VALUES (
    'new_signup',
    'New User Signed Up!',
    format('%s just signed up!', _full_name),
    jsonb_build_object(
      'user_id', NEW.id,
      'email', NEW.email,
      'full_name', _full_name,
      'referred_by', _referred_by_code,
      'birth_year', _birth_year,
      'birth_month', _birth_month
    ),
    '/admin/users'
  );

  RETURN NEW;
END;
$$;
