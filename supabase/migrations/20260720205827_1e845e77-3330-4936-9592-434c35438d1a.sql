
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state_of_residence text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _referral_code text;
  _referred_by_code text;
  _full_name text;
  _birth_year int;
  _birth_month int;
  _state text;
BEGIN
  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'User');
  _referred_by_code := LOWER(NEW.raw_user_meta_data->>'referred_by_code');
  _state := NULLIF(NEW.raw_user_meta_data->>'state_of_residence', '');

  BEGIN
    _birth_year := NULLIF(NEW.raw_user_meta_data->>'birth_year', '')::int;
  EXCEPTION WHEN OTHERS THEN _birth_year := NULL; END;

  BEGIN
    _birth_month := NULLIF(NEW.raw_user_meta_data->>'birth_month', '')::int;
  EXCEPTION WHEN OTHERS THEN _birth_month := NULL; END;

  _referral_code := upper(substr(md5(random()::text), 1, 8));

  INSERT INTO public.profiles (
    id, full_name, referral_code, referred_by_code, phone_number, birth_year, birth_month, state_of_residence
  ) VALUES (
    NEW.id, _full_name, _referral_code, _referred_by_code,
    NEW.raw_user_meta_data->>'phone_number', _birth_year, _birth_month, _state
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
      'birth_month', _birth_month,
      'state_of_residence', _state
    ),
    '/admin/users'
  );

  RETURN NEW;
END;
$function$;
