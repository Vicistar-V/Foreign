-- Replace the referral code generator with name-based system
-- Limit: 20 characters (clean and practical)

DROP FUNCTION IF EXISTS public.generate_referral_code() CASCADE;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_base_code TEXT;
  v_final_code TEXT;
  v_counter INTEGER := 0;
  v_exists BOOLEAN;
BEGIN
  -- =====================================================
  -- STEP 1: Clean the user's name
  -- =====================================================
  
  -- Take full_name, convert to lowercase
  v_base_code := lower(NEW.full_name);
  
  -- Remove accents (José → jose)
  v_base_code := unaccent(v_base_code);
  
  -- Remove spaces and special characters (keep only a-z, 0-9)
  v_base_code := regexp_replace(v_base_code, '[^a-z0-9]', '', 'g');
  
  -- Limit to 20 characters
  v_base_code := substring(v_base_code from 1 for 20);
  
  -- =====================================================
  -- STEP 2: Fallback if empty
  -- =====================================================
  
  IF v_base_code = '' OR v_base_code IS NULL THEN
    -- Generate fallback: "user" + 3 random alphanumeric
    v_base_code := 'user' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 3));
  END IF;
  
  -- =====================================================
  -- STEP 3: Ensure uniqueness
  -- =====================================================
  
  v_final_code := v_base_code;
  
  LOOP
    -- Check if this code already exists
    SELECT EXISTS(
      SELECT 1 FROM public.profiles WHERE referral_code = v_final_code
    ) INTO v_exists;
    
    -- If unique, we're done!
    EXIT WHEN NOT v_exists;
    
    -- If not unique, try with a number suffix
    v_counter := v_counter + 1;
    v_final_code := v_base_code || v_counter::text;
    
    -- Safety: if we've tried 1000 variations, give up and use random
    IF v_counter > 1000 THEN
      v_final_code := v_base_code || upper(substring(md5(random()::text) from 1 for 4));
      EXIT;
    END IF;
  END LOOP;
  
  -- =====================================================
  -- STEP 4: Assign to the new user
  -- =====================================================
  
  NEW.referral_code := v_final_code;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS set_referral_code_on_insert ON public.profiles;

CREATE TRIGGER set_referral_code_on_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_referral_code();

-- Enable the unaccent extension if not already enabled
CREATE EXTENSION IF NOT EXISTS unaccent;