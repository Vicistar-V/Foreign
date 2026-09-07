
-- Step 1: Fix existing drop entry tiers to jackpot/high/base
-- Jackpot winner (highest amount - Olumide at 6000)
UPDATE public.drop_entries 
SET metadata = '{"tier": "jackpot", "tierRank": 1}'::jsonb
WHERE drop_date = '2025-12-27' AND user_id = '66666666-6666-6666-6666-666666666666';

-- High tier winners (Ngozi 5200, Ibrahim 4100)  
UPDATE public.drop_entries 
SET metadata = '{"tier": "high", "tierRank": 1}'::jsonb
WHERE drop_date = '2025-12-27' AND user_id = '55555555-5555-5555-5555-555555555555';

UPDATE public.drop_entries 
SET metadata = '{"tier": "high", "tierRank": 2}'::jsonb
WHERE drop_date = '2025-12-27' AND user_id = '44444444-4444-4444-4444-444444444444';

-- Base tier winners (Emeka 3450, Chioma 2278, Chinedu 520)
UPDATE public.drop_entries 
SET metadata = '{"tier": "base", "tierRank": 1}'::jsonb
WHERE drop_date = '2025-12-27' AND user_id = '22222222-2222-2222-2222-222222222222';

UPDATE public.drop_entries 
SET metadata = '{"tier": "base", "tierRank": 2}'::jsonb
WHERE drop_date = '2025-12-27' AND user_id = '11111111-1111-1111-1111-111111111111';

UPDATE public.drop_entries 
SET metadata = '{"tier": "base", "tierRank": 3}'::jsonb
WHERE drop_date = '2025-12-27' AND user_id = 'f73e5c41-41cf-4a8a-a64c-1d4aacf5e4f3';

-- Step 2: Add protected entries using existing fake profiles
INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
('33333333-3333-3333-3333-333333333333', '2025-12-27', 200, 200, 0, 'protected', 0, '{}'::jsonb),
('77777777-7777-7777-7777-777777777777', '2025-12-27', 200, 200, 0, 'protected', 0, '{}'::jsonb),
('88888888-8888-8888-8888-888888888888', '2025-12-27', 200, 200, 0, 'protected', 0, '{}'::jsonb),
('99999999-9999-9999-9999-999999999999', '2025-12-27', 200, 200, 0, 'protected', 0, '{}'::jsonb),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-12-27', 200, 200, 0, 'protected', 0, '{}'::jsonb);

-- Step 3: Add contributor/pillar entries using real user profiles
INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
('924ced38-4c65-41a0-9afe-d13e5af2838c', '2025-12-27', 200, 200, 0, 'contributor', 0, '{}'::jsonb),
('5402f6e0-f58a-4606-88a6-f059d05fe916', '2025-12-27', 200, 200, 0, 'contributor', 0, '{}'::jsonb),
('85ea81c2-752b-4d7e-a8e4-1facce372158', '2025-12-27', 200, 200, 0, 'contributor', 0, '{}'::jsonb),
('96278216-db07-450a-a28c-2eb691a0403a', '2025-12-27', 200, 200, 0, 'contributor', 0, '{}'::jsonb),
('5c345e36-625a-40af-9a5f-9ff8d5b15787', '2025-12-27', 200, 200, 0, 'contributor', 0, '{}'::jsonb);

-- Step 4: Update daily_drop_logs with correct counts
UPDATE public.daily_drop_logs 
SET 
  total_participants = 16,
  winners_count = 6,
  protected_count = 5,
  contributors_count = 5,
  total_distributed = 3200
WHERE drop_date = '2025-12-27';
