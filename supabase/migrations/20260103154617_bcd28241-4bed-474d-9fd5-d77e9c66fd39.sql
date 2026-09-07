-- Delete 150 ghost profiles (keep first 50 by creation date)
-- Step 1: Delete drop entries for ghost users to be removed
DELETE FROM drop_entries 
WHERE user_id IN (
  SELECT id 
  FROM profiles 
  WHERE referred_by_code = 'SYSTEM'
  ORDER BY created_at ASC
  OFFSET 50
);

-- Step 2: Delete transactions for ghost users to be removed
DELETE FROM transactions 
WHERE user_id IN (
  SELECT id 
  FROM profiles 
  WHERE referred_by_code = 'SYSTEM'
  ORDER BY created_at ASC
  OFFSET 50
);

-- Step 3: Delete user_balances for ghost users to be removed
DELETE FROM user_balances 
WHERE user_id IN (
  SELECT id 
  FROM profiles 
  WHERE referred_by_code = 'SYSTEM'
  ORDER BY created_at ASC
  OFFSET 50
);

-- Step 4: Delete the ghost profiles themselves
DELETE FROM profiles 
WHERE id IN (
  SELECT id 
  FROM profiles 
  WHERE referred_by_code = 'SYSTEM'
  ORDER BY created_at ASC
  OFFSET 50
);