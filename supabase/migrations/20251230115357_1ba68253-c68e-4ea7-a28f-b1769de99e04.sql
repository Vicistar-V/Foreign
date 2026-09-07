-- Update handle_new_user() function to also save phone_number
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_referral_code TEXT;
BEGIN
  -- Generate unique referral code
  new_referral_code := UPPER(SUBSTRING(MD5(NEW.id::text || NOW()::text) FROM 1 FOR 8));
  
  INSERT INTO public.profiles (id, full_name, phone_number, referral_code, referred_by_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.raw_user_meta_data->>'phone_number',
    new_referral_code,
    NEW.raw_user_meta_data->>'referred_by_code'
  );
  
  -- Create user_balances entry
  INSERT INTO public.user_balances (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;