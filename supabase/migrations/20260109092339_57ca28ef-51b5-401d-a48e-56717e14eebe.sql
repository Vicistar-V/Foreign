-- Turn off auto_compound_enabled for all users
UPDATE profiles 
SET auto_compound_enabled = false 
WHERE auto_compound_enabled = true;