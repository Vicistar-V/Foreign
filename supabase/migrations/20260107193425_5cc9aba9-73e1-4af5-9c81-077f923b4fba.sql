-- Step 1: Add the new enum value (this will be committed separately)
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'genesis_bonus';