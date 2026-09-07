-- Create sample demo profiles for realistic results display
-- These are demo users to populate the winners/results pages

-- First, create demo user profiles with Nigerian names
INSERT INTO public.profiles (id, full_name, referral_code, is_member, avatar_url) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Chioma Adebayo', 'chiomaadebayo', true, NULL),
  ('22222222-2222-2222-2222-222222222222', 'Emeka Okonkwo', 'emekaokonkwo', true, NULL),
  ('33333333-3333-3333-3333-333333333333', 'Fatima Bello', 'fatimabello', true, NULL),
  ('44444444-4444-4444-4444-444444444444', 'Ibrahim Mohammed', 'ibrahimmohammed', true, NULL),
  ('55555555-5555-5555-5555-555555555555', 'Ngozi Eze', 'ngozieze', true, NULL),
  ('66666666-6666-6666-6666-666666666666', 'Olumide Ajayi', 'olumideajayi', true, NULL),
  ('77777777-7777-7777-7777-777777777777', 'Precious Udoh', 'preciousudoh', true, NULL),
  ('88888888-8888-8888-8888-888888888888', 'Samuel Nnamdi', 'samuelnnamdi', true, NULL),
  ('99999999-9999-9999-9999-999999999999', 'Yetunde Bakare', 'yetundebakare', true, NULL),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tochukwu Igwe', 'tochukwuigwe', true, NULL)
ON CONFLICT (id) DO NOTHING;

-- Create daily_drop_logs for past 5 days (completed distributions)
INSERT INTO public.daily_drop_logs (id, drop_date, status, triggered_by, total_participants, total_distributed, winners_count, protected_count, contributors_count, processed_at) VALUES
  ('d1111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '1 day', 'completed', 'cron', 8, 1280, 2, 4, 2, (CURRENT_DATE - INTERVAL '1 day')::timestamp + TIME '22:00:00'),
  ('d2222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '2 days', 'completed', 'cron', 6, 960, 1, 3, 2, (CURRENT_DATE - INTERVAL '2 days')::timestamp + TIME '22:00:00'),
  ('d3333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '3 days', 'completed', 'cron', 10, 1600, 2, 5, 3, (CURRENT_DATE - INTERVAL '3 days')::timestamp + TIME '22:00:00'),
  ('d4444444-4444-4444-4444-444444444444', CURRENT_DATE - INTERVAL '4 days', 'completed', 'cron', 7, 1120, 1, 4, 2, (CURRENT_DATE - INTERVAL '4 days')::timestamp + TIME '22:00:00'),
  ('d5555555-5555-5555-5555-555555555555', CURRENT_DATE - INTERVAL '5 days', 'completed', 'cron', 5, 800, 1, 2, 2, (CURRENT_DATE - INTERVAL '5 days')::timestamp + TIME '22:00:00');

-- Create drop_entries for Day 1 (8 participants: 2 winners, 4 protected, 2 contributors)
INSERT INTO public.drop_entries (id, user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  -- Winners
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '1 day', 200, 200, 0, 'beneficiary', 800, '{"tier": "jackpot", "tierRank": 1}'),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '1 day', 200, 200, 0, 'beneficiary', 480, '{"tier": "high", "tierRank": 2}'),
  -- Protected
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '1 day', 200, 200, 0, 'protected', 0, '{}'),
  (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', CURRENT_DATE - INTERVAL '1 day', 200, 200, 0, 'protected', 0, '{}'),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', CURRENT_DATE - INTERVAL '1 day', 200, 200, 0, 'protected', 0, '{}'),
  (gen_random_uuid(), '66666666-6666-6666-6666-666666666666', CURRENT_DATE - INTERVAL '1 day', 200, 200, 0, 'protected', 0, '{}'),
  -- Contributors
  (gen_random_uuid(), '77777777-7777-7777-7777-777777777777', CURRENT_DATE - INTERVAL '1 day', 200, 200, 0, 'contributor', 0, '{}'),
  (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', CURRENT_DATE - INTERVAL '1 day', 200, 200, 0, 'contributor', 0, '{}');

-- Create drop_entries for Day 2 (6 participants: 1 winner, 3 protected, 2 contributors)
INSERT INTO public.drop_entries (id, user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', CURRENT_DATE - INTERVAL '2 days', 200, 200, 0, 'beneficiary', 960, '{"tier": "jackpot", "tierRank": 1}'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '2 days', 200, 200, 0, 'protected', 0, '{}'),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '2 days', 200, 200, 0, 'protected', 0, '{}'),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '2 days', 200, 200, 0, 'protected', 0, '{}'),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', CURRENT_DATE - INTERVAL '2 days', 200, 200, 0, 'contributor', 0, '{}'),
  (gen_random_uuid(), '66666666-6666-6666-6666-666666666666', CURRENT_DATE - INTERVAL '2 days', 200, 200, 0, 'contributor', 0, '{}');

-- Create drop_entries for Day 3 (10 participants: 2 winners, 5 protected, 3 contributors)
INSERT INTO public.drop_entries (id, user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  (gen_random_uuid(), '99999999-9999-9999-9999-999999999999', CURRENT_DATE - INTERVAL '3 days', 200, 200, 0, 'beneficiary', 1000, '{"tier": "jackpot", "tierRank": 1}'),
  (gen_random_uuid(), '77777777-7777-7777-7777-777777777777', CURRENT_DATE - INTERVAL '3 days', 200, 200, 0, 'beneficiary', 600, '{"tier": "high", "tierRank": 2}'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '3 days', 200, 200, 0, 'protected', 0, '{}'),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '3 days', 200, 200, 0, 'protected', 0, '{}'),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '3 days', 200, 200, 0, 'protected', 0, '{}'),
  (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', CURRENT_DATE - INTERVAL '3 days', 200, 200, 0, 'protected', 0, '{}'),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', CURRENT_DATE - INTERVAL '3 days', 200, 200, 0, 'protected', 0, '{}'),
  (gen_random_uuid(), '66666666-6666-6666-6666-666666666666', CURRENT_DATE - INTERVAL '3 days', 200, 200, 0, 'contributor', 0, '{}'),
  (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', CURRENT_DATE - INTERVAL '3 days', 200, 200, 0, 'contributor', 0, '{}'),
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', CURRENT_DATE - INTERVAL '3 days', 200, 200, 0, 'contributor', 0, '{}');

-- Create drop_entries for Day 4 (7 participants: 1 winner, 4 protected, 2 contributors)
INSERT INTO public.drop_entries (id, user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  (gen_random_uuid(), '66666666-6666-6666-6666-666666666666', CURRENT_DATE - INTERVAL '4 days', 200, 200, 0, 'beneficiary', 1120, '{"tier": "jackpot", "tierRank": 1}'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '4 days', 200, 200, 0, 'protected', 0, '{}'),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '4 days', 200, 200, 0, 'protected', 0, '{}'),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '4 days', 200, 200, 0, 'protected', 0, '{}'),
  (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', CURRENT_DATE - INTERVAL '4 days', 200, 200, 0, 'protected', 0, '{}'),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', CURRENT_DATE - INTERVAL '4 days', 200, 200, 0, 'contributor', 0, '{}'),
  (gen_random_uuid(), '77777777-7777-7777-7777-777777777777', CURRENT_DATE - INTERVAL '4 days', 200, 200, 0, 'contributor', 0, '{}');

-- Create drop_entries for Day 5 (5 participants: 1 winner, 2 protected, 2 contributors)
INSERT INTO public.drop_entries (id, user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', CURRENT_DATE - INTERVAL '5 days', 200, 200, 0, 'beneficiary', 800, '{"tier": "jackpot", "tierRank": 1}'),
  (gen_random_uuid(), '99999999-9999-9999-9999-999999999999', CURRENT_DATE - INTERVAL '5 days', 200, 200, 0, 'protected', 0, '{}'),
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', CURRENT_DATE - INTERVAL '5 days', 200, 200, 0, 'protected', 0, '{}'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '5 days', 200, 200, 0, 'contributor', 0, '{}'),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '5 days', 200, 200, 0, 'contributor', 0, '{}');