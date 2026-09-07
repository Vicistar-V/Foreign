-- Fix referral code case sensitivity

-- 1. Normalize all existing referred_by_code to lowercase
UPDATE profiles 
SET referred_by_code = LOWER(referred_by_code)
WHERE referred_by_code IS NOT NULL 
  AND referred_by_code != LOWER(referred_by_code);

-- 2. Update handle_new_user trigger to always save referred_by_code in lowercase
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_referral_code TEXT;
BEGIN
  -- Generate unique referral code (stays uppercase for display)
  new_referral_code := UPPER(SUBSTRING(MD5(NEW.id::text || NOW()::text) FROM 1 FOR 8));
  
  INSERT INTO public.profiles (id, full_name, phone_number, referral_code, referred_by_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.raw_user_meta_data->>'phone_number',
    new_referral_code,
    LOWER(NEW.raw_user_meta_data->>'referred_by_code')  -- Always lowercase
  );
  
  -- Create cached_balances entry (cache for display purposes only)
  INSERT INTO public.cached_balances (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$function$;