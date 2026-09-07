-- =====================================================
-- FIX BANK CODE UNIQUE CONSTRAINT FOR MULTI-COUNTRY SUPPORT
-- =====================================================
-- Change unique constraint from global 'code' to per-country '(code, country)'
-- This allows the same bank code to exist in different countries

-- Drop the existing global unique constraint on code
ALTER TABLE public.banks DROP CONSTRAINT IF EXISTS banks_code_key;

-- Add new unique constraint on (code, country) combination
ALTER TABLE public.banks ADD CONSTRAINT banks_code_country_unique UNIQUE (code, country);

-- Verification: Check if the constraint was added
DO $$
DECLARE
  v_constraint_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'banks' 
    AND constraint_name = 'banks_code_country_unique'
    AND constraint_type = 'UNIQUE'
  ) INTO v_constraint_exists;
  
  IF v_constraint_exists THEN
    RAISE NOTICE '✅ Bank code unique constraint successfully updated to (code, country)';
  ELSE
    RAISE EXCEPTION '❌ Failed to add banks_code_country_unique constraint';
  END IF;
END $$;