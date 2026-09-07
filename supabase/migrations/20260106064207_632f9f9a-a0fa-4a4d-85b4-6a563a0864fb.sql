-- Drop the old restrictive RLS policy that blocks all updates when name is locked
DROP POLICY IF EXISTS "Users can update their own unlocked profile" ON profiles;

-- Create new permissive RLS policy - just checks user owns the row
CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Create trigger function that prevents name changes when locked (but allows admins)
CREATE OR REPLACE FUNCTION prevent_locked_name_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If name is locked and name is being changed
  IF OLD.is_name_locked = true AND NEW.full_name IS DISTINCT FROM OLD.full_name THEN
    -- Check if the current user is an admin - if so, allow the change
    IF has_role(auth.uid(), 'admin') THEN
      RETURN NEW;
    END IF;
    -- Not an admin, block the change
    RAISE EXCEPTION 'Your name is locked and cannot be changed. Contact support if you need help.';
  END IF;
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS enforce_name_lock ON profiles;
CREATE TRIGGER enforce_name_lock
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION prevent_locked_name_change();