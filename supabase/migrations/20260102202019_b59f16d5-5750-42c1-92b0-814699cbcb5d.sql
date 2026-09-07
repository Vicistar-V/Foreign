
-- =====================================================
-- TONIGHT'S MANUAL REDISTRIBUTION: ₦10,000 → 4 WINNERS
-- =====================================================

-- Step 1: Delete the original ₦10,000 jackpot transaction from CLETUS
DELETE FROM transactions 
WHERE id = '5424f3f0-c32f-4bb5-ad6c-40f16d965afc';

-- Step 2: Insert 4 new winner transactions (₦10,000 total)
INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
VALUES 
  -- CLETUS NWACHUKWU - GOLD Tier: ₦3,500
  ('6ce252d3-a7cd-4f23-9ba2-9e337def27f7', 'earnings', 3500, 'drop_win', 'Winner (GOLD Tier) - Daily Distribution 2026-01-02', 'completed', '{"tier": "gold", "tierRank": 1, "drop_date": "2026-01-02"}'),
  -- Chinedu Joseph ibeh - SILVER Tier: ₦2,500
  ('f73e5c41-41cf-4a8a-a64c-1d4aacf5e4f3', 'earnings', 2500, 'drop_win', 'Winner (SILVER Tier) - Daily Distribution 2026-01-02', 'completed', '{"tier": "silver", "tierRank": 2, "drop_date": "2026-01-02"}'),
  -- OLORUNYOMI DAYO - BRONZE Tier: ₦2,000
  ('ed5061b7-c65f-4115-927b-da09f4faffa9', 'earnings', 2000, 'drop_win', 'Winner (BRONZE Tier) - Daily Distribution 2026-01-02', 'completed', '{"tier": "bronze", "tierRank": 3, "drop_date": "2026-01-02"}'),
  -- Ogechi Aruocha - BRONZE Tier: ₦2,000
  ('fc595f77-07f8-4e93-b0d5-cc73dc9a0f19', 'earnings', 2000, 'drop_win', 'Winner (BRONZE Tier) - Daily Distribution 2026-01-02', 'completed', '{"tier": "bronze", "tierRank": 4, "drop_date": "2026-01-02"}');

-- Step 3: Update CLETUS's drop_entry with new amount
UPDATE drop_entries 
SET win_amount = 3500, 
    metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{tier}', '"gold"') || '{"tierRank": 1}'
WHERE id = 'b71206e5-3a64-4ab8-a66d-99a7206d9285';

-- Step 4: Promote Chinedu from contributor → beneficiary
UPDATE drop_entries 
SET result_status = 'beneficiary', 
    win_amount = 2500, 
    metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{tier}', '"silver"') || '{"tierRank": 2}'
WHERE id = '5e2170b9-3c30-4af1-a24a-9b740b9e14e5';

-- Step 5: Promote OLORUNYOMI from contributor → beneficiary
UPDATE drop_entries 
SET result_status = 'beneficiary', 
    win_amount = 2000, 
    metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{tier}', '"bronze"') || '{"tierRank": 3}'
WHERE id = 'e88ccbb0-380e-4cae-851a-1e1d269004c1';

-- Step 6: Promote Ogechi from contributor → beneficiary
UPDATE drop_entries 
SET result_status = 'beneficiary', 
    win_amount = 2000, 
    metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{tier}', '"bronze"') || '{"tierRank": 4}'
WHERE id = '3ad370db-e1ca-4b1e-bfa4-882f8348f0aa';

-- Step 7: Update daily_drop_logs to reflect 4 winners, 0 contributors
UPDATE daily_drop_logs 
SET 
  winners_count = 4,
  contributors_count = 0,
  metadata = '{"manual_redistribution": true, "original_winners": 1, "adjusted_by": "admin", "redistribution_reason": "Launch night - spread the love"}'
WHERE drop_date = '2026-01-02';
