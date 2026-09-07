-- Fix tier names to match the system: jackpot, high, base (not gold, silver, bronze)

-- CLETUS - jackpot winner (was "gold")
UPDATE drop_entries 
SET metadata = jsonb_set(
  jsonb_set(metadata, '{tier}', '"jackpot"'),
  '{tierRank}', '1'
)
WHERE id = 'b71206e5-3a64-4ab8-a66d-99a7206d9285';

-- Chinedu Joseph - high tier (was "silver")
UPDATE drop_entries 
SET metadata = jsonb_set(
  jsonb_set(metadata, '{tier}', '"high"'),
  '{tierRank}', '2'
)
WHERE id = '5e2170b9-3c30-4af1-a24a-9b740b9e14e5';

-- OLORUNYOMI DAYO - base tier (was "bronze")
UPDATE drop_entries 
SET metadata = jsonb_set(
  jsonb_set(metadata, '{tier}', '"base"'),
  '{tierRank}', '3'
)
WHERE id = 'e88ccbb0-380e-4cae-851a-1e1d269004c1';

-- Ogechi Aruocha - base tier (was "bronze")
UPDATE drop_entries 
SET metadata = jsonb_set(
  jsonb_set(metadata, '{tier}', '"base"'),
  '{tierRank}', '4'
)
WHERE id = '3ad370db-e1ca-4b1e-bfa4-882f8348f0aa';