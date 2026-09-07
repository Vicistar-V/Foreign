-- Create function to prevent SYSTEM_TREASURY deletion
CREATE OR REPLACE FUNCTION public.prevent_system_treasury_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.id = '00000000-0000-0000-0000-000000000000' THEN
    RAISE EXCEPTION 'Cannot delete SYSTEM_TREASURY user - this account is protected';
  END IF;
  RETURN OLD;
END;
$$;

-- Create trigger on profiles table
CREATE TRIGGER protect_system_treasury
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_system_treasury_deletion();