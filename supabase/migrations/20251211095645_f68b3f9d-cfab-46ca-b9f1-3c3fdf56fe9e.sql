-- Clear existing demo drop data and recreate with larger amounts and more history
DELETE FROM public.drop_entries WHERE user_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555',
  '66666666-6666-6666-6666-666666666666',
  '77777777-7777-7777-7777-777777777777',
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
);

DELETE FROM public.daily_drop_logs WHERE id IN (
  'd1111111-1111-1111-1111-111111111111',
  'd2222222-2222-2222-2222-222222222222',
  'd3333333-3333-3333-3333-333333333333',
  'd4444444-4444-4444-4444-444444444444',
  'd5555555-5555-5555-5555-555555555555'
);

-- Create 21 days of drop logs (3 weeks) with larger amounts
INSERT INTO public.daily_drop_logs (drop_date, status, triggered_by, total_participants, total_distributed, winners_count, protected_count, contributors_count, processed_at) VALUES
  -- Week 1 (most recent)
  (CURRENT_DATE - INTERVAL '1 day', 'completed', 'cron', 25, 18500, 5, 12, 8, (CURRENT_DATE - INTERVAL '1 day')::timestamp + TIME '22:00:00'),
  (CURRENT_DATE - INTERVAL '2 days', 'completed', 'cron', 22, 16200, 4, 11, 7, (CURRENT_DATE - INTERVAL '2 days')::timestamp + TIME '22:00:00'),
  (CURRENT_DATE - INTERVAL '3 days', 'completed', 'cron', 30, 22800, 6, 15, 9, (CURRENT_DATE - INTERVAL '3 days')::timestamp + TIME '22:00:00'),
  (CURRENT_DATE - INTERVAL '4 days', 'completed', 'cron', 18, 13200, 4, 9, 5, (CURRENT_DATE - INTERVAL '4 days')::timestamp + TIME '22:00:00'),
  (CURRENT_DATE - INTERVAL '5 days', 'completed', 'cron', 28, 21000, 5, 14, 9, (CURRENT_DATE - INTERVAL '5 days')::timestamp + TIME '22:00:00'),
  (CURRENT_DATE - INTERVAL '6 days', 'completed', 'cron', 20, 14800, 4, 10, 6, (CURRENT_DATE - INTERVAL '6 days')::timestamp + TIME '22:00:00'),
  (CURRENT_DATE - INTERVAL '7 days', 'completed', 'cron', 35, 26500, 7, 17, 11, (CURRENT_DATE - INTERVAL '7 days')::timestamp + TIME '22:00:00'),
  -- Week 2
  (CURRENT_DATE - INTERVAL '8 days', 'completed', 'cron', 24, 17600, 5, 12, 7, (CURRENT_DATE - INTERVAL '8 days')::timestamp + TIME '22:00:00'),
  (CURRENT_DATE - INTERVAL '9 days', 'completed', 'cron', 19, 14000, 4, 9, 6, (CURRENT_DATE - INTERVAL '9 days')::timestamp + TIME '22:00:00'),
  (CURRENT_DATE - INTERVAL '10 days', 'completed', 'cron', 32, 24200, 6, 16, 10, (CURRENT_DATE - INTERVAL '10 days')::timestamp + TIME '22:00:00'),
  (CURRENT_DATE - INTERVAL '11 days', 'completed', 'cron', 21, 15400, 4, 10, 7, (CURRENT_DATE - INTERVAL '11 days')::timestamp + TIME '22:00:00'),
  (CURRENT_DATE - INTERVAL '12 days', 'completed', 'cron', 27, 20000, 5, 13, 9, (CURRENT_DATE - INTERVAL '12 days')::timestamp + TIME '22:00:00'),
  (CURRENT_DATE - INTERVAL '13 days', 'completed', 'cron', 23, 16800, 5, 11, 7, (CURRENT_DATE - INTERVAL '13 days')::timestamp + TIME '22:00:00'),
  (CURRENT_DATE - INTERVAL '14 days', 'completed', 'cron', 38, 28800, 8, 19, 11, (CURRENT_DATE - INTERVAL '14 days')::timestamp + TIME '22:00:00'),
  -- Week 3
  (CURRENT_DATE - INTERVAL '15 days', 'completed', 'cron', 26, 19200, 5, 13, 8, (CURRENT_DATE - INTERVAL '15 days')::timestamp + TIME '22:00:00'),
  (CURRENT_DATE - INTERVAL '16 days', 'completed', 'cron', 17, 12400, 3, 8, 6, (CURRENT_DATE - INTERVAL '16 days')::timestamp + TIME '22:00:00'),
  (CURRENT_DATE - INTERVAL '17 days', 'completed', 'cron', 29, 21600, 6, 14, 9, (CURRENT_DATE - INTERVAL '17 days')::timestamp + TIME '22:00:00'),
  (CURRENT_DATE - INTERVAL '18 days', 'completed', 'cron', 22, 16000, 4, 11, 7, (CURRENT_DATE - INTERVAL '18 days')::timestamp + TIME '22:00:00'),
  (CURRENT_DATE - INTERVAL '19 days', 'completed', 'cron', 31, 23200, 6, 15, 10, (CURRENT_DATE - INTERVAL '19 days')::timestamp + TIME '22:00:00'),
  (CURRENT_DATE - INTERVAL '20 days', 'completed', 'cron', 20, 14600, 4, 10, 6, (CURRENT_DATE - INTERVAL '20 days')::timestamp + TIME '22:00:00'),
  (CURRENT_DATE - INTERVAL '21 days', 'completed', 'cron', 33, 25000, 7, 16, 10, (CURRENT_DATE - INTERVAL '21 days')::timestamp + TIME '22:00:00');

-- Day 1 entries (25 participants: 5 winners, 12 protected, 8 contributors)
INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '1 day', 200, 200, 0, 'beneficiary', 8500, '{"tier": "jackpot", "tierRank": 1}'),
  ('22222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '1 day', 200, 200, 0, 'beneficiary', 4200, '{"tier": "high", "tierRank": 2}'),
  ('33333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '1 day', 200, 200, 0, 'beneficiary', 2800, '{"tier": "high", "tierRank": 3}'),
  ('44444444-4444-4444-4444-444444444444', CURRENT_DATE - INTERVAL '1 day', 200, 200, 0, 'beneficiary', 1800, '{"tier": "base", "tierRank": 4}'),
  ('55555555-5555-5555-5555-555555555555', CURRENT_DATE - INTERVAL '1 day', 200, 200, 0, 'beneficiary', 1200, '{"tier": "base", "tierRank": 5}'),
  ('66666666-6666-6666-6666-666666666666', CURRENT_DATE - INTERVAL '1 day', 200, 200, 0, 'protected', 0, '{}'),
  ('77777777-7777-7777-7777-777777777777', CURRENT_DATE - INTERVAL '1 day', 200, 200, 0, 'protected', 0, '{}'),
  ('88888888-8888-8888-8888-888888888888', CURRENT_DATE - INTERVAL '1 day', 200, 200, 0, 'protected', 0, '{}'),
  ('99999999-9999-9999-9999-999999999999', CURRENT_DATE - INTERVAL '1 day', 200, 200, 0, 'protected', 0, '{}'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', CURRENT_DATE - INTERVAL '1 day', 200, 200, 0, 'contributor', 0, '{}');

-- Day 2 entries (22 participants: 4 winners, 11 protected, 7 contributors)
INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  ('44444444-4444-4444-4444-444444444444', CURRENT_DATE - INTERVAL '2 days', 200, 200, 0, 'beneficiary', 7800, '{"tier": "jackpot", "tierRank": 1}'),
  ('77777777-7777-7777-7777-777777777777', CURRENT_DATE - INTERVAL '2 days', 200, 200, 0, 'beneficiary', 4000, '{"tier": "high", "tierRank": 2}'),
  ('99999999-9999-9999-9999-999999999999', CURRENT_DATE - INTERVAL '2 days', 200, 200, 0, 'beneficiary', 2600, '{"tier": "high", "tierRank": 3}'),
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '2 days', 200, 200, 0, 'beneficiary', 1800, '{"tier": "base", "tierRank": 4}'),
  ('22222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '2 days', 200, 200, 0, 'protected', 0, '{}'),
  ('33333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '2 days', 200, 200, 0, 'protected', 0, '{}'),
  ('55555555-5555-5555-5555-555555555555', CURRENT_DATE - INTERVAL '2 days', 200, 200, 0, 'contributor', 0, '{}'),
  ('66666666-6666-6666-6666-666666666666', CURRENT_DATE - INTERVAL '2 days', 200, 200, 0, 'contributor', 0, '{}');

-- Day 3 entries (30 participants: 6 winners)
INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  ('88888888-8888-8888-8888-888888888888', CURRENT_DATE - INTERVAL '3 days', 200, 200, 0, 'beneficiary', 10200, '{"tier": "jackpot", "tierRank": 1}'),
  ('33333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '3 days', 200, 200, 0, 'beneficiary', 5000, '{"tier": "high", "tierRank": 2}'),
  ('66666666-6666-6666-6666-666666666666', CURRENT_DATE - INTERVAL '3 days', 200, 200, 0, 'beneficiary', 3400, '{"tier": "high", "tierRank": 3}'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', CURRENT_DATE - INTERVAL '3 days', 200, 200, 0, 'beneficiary', 2200, '{"tier": "base", "tierRank": 4}'),
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '3 days', 200, 200, 0, 'beneficiary', 1200, '{"tier": "base", "tierRank": 5}'),
  ('22222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '3 days', 200, 200, 0, 'beneficiary', 800, '{"tier": "base", "tierRank": 6}'),
  ('44444444-4444-4444-4444-444444444444', CURRENT_DATE - INTERVAL '3 days', 200, 200, 0, 'protected', 0, '{}'),
  ('55555555-5555-5555-5555-555555555555', CURRENT_DATE - INTERVAL '3 days', 200, 200, 0, 'protected', 0, '{}'),
  ('77777777-7777-7777-7777-777777777777', CURRENT_DATE - INTERVAL '3 days', 200, 200, 0, 'contributor', 0, '{}'),
  ('99999999-9999-9999-9999-999999999999', CURRENT_DATE - INTERVAL '3 days', 200, 200, 0, 'contributor', 0, '{}');

-- Day 4-7 entries (varied winners)
INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  ('55555555-5555-5555-5555-555555555555', CURRENT_DATE - INTERVAL '4 days', 200, 200, 0, 'beneficiary', 6200, '{"tier": "jackpot", "tierRank": 1}'),
  ('99999999-9999-9999-9999-999999999999', CURRENT_DATE - INTERVAL '4 days', 200, 200, 0, 'beneficiary', 3600, '{"tier": "high", "tierRank": 2}'),
  ('22222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '4 days', 200, 200, 0, 'beneficiary', 2000, '{"tier": "base", "tierRank": 3}'),
  ('77777777-7777-7777-7777-777777777777', CURRENT_DATE - INTERVAL '4 days', 200, 200, 0, 'beneficiary', 1400, '{"tier": "base", "tierRank": 4}'),
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '4 days', 200, 200, 0, 'protected', 0, '{}'),
  ('33333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '4 days', 200, 200, 0, 'contributor', 0, '{}');

INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', CURRENT_DATE - INTERVAL '5 days', 200, 200, 0, 'beneficiary', 9500, '{"tier": "jackpot", "tierRank": 1}'),
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '5 days', 200, 200, 0, 'beneficiary', 4800, '{"tier": "high", "tierRank": 2}'),
  ('44444444-4444-4444-4444-444444444444', CURRENT_DATE - INTERVAL '5 days', 200, 200, 0, 'beneficiary', 3200, '{"tier": "high", "tierRank": 3}'),
  ('66666666-6666-6666-6666-666666666666', CURRENT_DATE - INTERVAL '5 days', 200, 200, 0, 'beneficiary', 2000, '{"tier": "base", "tierRank": 4}'),
  ('88888888-8888-8888-8888-888888888888', CURRENT_DATE - INTERVAL '5 days', 200, 200, 0, 'beneficiary', 1500, '{"tier": "base", "tierRank": 5}'),
  ('22222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '5 days', 200, 200, 0, 'protected', 0, '{}'),
  ('33333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '5 days', 200, 200, 0, 'protected', 0, '{}'),
  ('55555555-5555-5555-5555-555555555555', CURRENT_DATE - INTERVAL '5 days', 200, 200, 0, 'contributor', 0, '{}');

INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  ('33333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '6 days', 200, 200, 0, 'beneficiary', 7000, '{"tier": "jackpot", "tierRank": 1}'),
  ('55555555-5555-5555-5555-555555555555', CURRENT_DATE - INTERVAL '6 days', 200, 200, 0, 'beneficiary', 3800, '{"tier": "high", "tierRank": 2}'),
  ('77777777-7777-7777-7777-777777777777', CURRENT_DATE - INTERVAL '6 days', 200, 200, 0, 'beneficiary', 2400, '{"tier": "base", "tierRank": 3}'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', CURRENT_DATE - INTERVAL '6 days', 200, 200, 0, 'beneficiary', 1600, '{"tier": "base", "tierRank": 4}'),
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '6 days', 200, 200, 0, 'protected', 0, '{}'),
  ('44444444-4444-4444-4444-444444444444', CURRENT_DATE - INTERVAL '6 days', 200, 200, 0, 'contributor', 0, '{}');

INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  ('66666666-6666-6666-6666-666666666666', CURRENT_DATE - INTERVAL '7 days', 200, 200, 0, 'beneficiary', 11500, '{"tier": "jackpot", "tierRank": 1}'),
  ('22222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '7 days', 200, 200, 0, 'beneficiary', 6000, '{"tier": "high", "tierRank": 2}'),
  ('44444444-4444-4444-4444-444444444444', CURRENT_DATE - INTERVAL '7 days', 200, 200, 0, 'beneficiary', 4000, '{"tier": "high", "tierRank": 3}'),
  ('88888888-8888-8888-8888-888888888888', CURRENT_DATE - INTERVAL '7 days', 200, 200, 0, 'beneficiary', 2500, '{"tier": "base", "tierRank": 4}'),
  ('99999999-9999-9999-9999-999999999999', CURRENT_DATE - INTERVAL '7 days', 200, 200, 0, 'beneficiary', 1500, '{"tier": "base", "tierRank": 5}'),
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '7 days', 200, 200, 0, 'beneficiary', 600, '{"tier": "base", "tierRank": 6}'),
  ('33333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '7 days', 200, 200, 0, 'beneficiary', 400, '{"tier": "base", "tierRank": 7}'),
  ('55555555-5555-5555-5555-555555555555', CURRENT_DATE - INTERVAL '7 days', 200, 200, 0, 'protected', 0, '{}'),
  ('77777777-7777-7777-7777-777777777777', CURRENT_DATE - INTERVAL '7 days', 200, 200, 0, 'protected', 0, '{}'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', CURRENT_DATE - INTERVAL '7 days', 200, 200, 0, 'contributor', 0, '{}');

-- Week 2 entries (Days 8-14)
INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  ('77777777-7777-7777-7777-777777777777', CURRENT_DATE - INTERVAL '8 days', 200, 200, 0, 'beneficiary', 8200, '{"tier": "jackpot", "tierRank": 1}'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', CURRENT_DATE - INTERVAL '8 days', 200, 200, 0, 'beneficiary', 4200, '{"tier": "high", "tierRank": 2}'),
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '8 days', 200, 200, 0, 'beneficiary', 2800, '{"tier": "high", "tierRank": 3}'),
  ('33333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '8 days', 200, 200, 0, 'beneficiary', 1600, '{"tier": "base", "tierRank": 4}'),
  ('55555555-5555-5555-5555-555555555555', CURRENT_DATE - INTERVAL '8 days', 200, 200, 0, 'beneficiary', 800, '{"tier": "base", "tierRank": 5}'),
  ('22222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '8 days', 200, 200, 0, 'protected', 0, '{}'),
  ('44444444-4444-4444-4444-444444444444', CURRENT_DATE - INTERVAL '8 days', 200, 200, 0, 'contributor', 0, '{}');

INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  ('22222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '9 days', 200, 200, 0, 'beneficiary', 6500, '{"tier": "jackpot", "tierRank": 1}'),
  ('66666666-6666-6666-6666-666666666666', CURRENT_DATE - INTERVAL '9 days', 200, 200, 0, 'beneficiary', 3600, '{"tier": "high", "tierRank": 2}'),
  ('88888888-8888-8888-8888-888888888888', CURRENT_DATE - INTERVAL '9 days', 200, 200, 0, 'beneficiary', 2200, '{"tier": "base", "tierRank": 3}'),
  ('99999999-9999-9999-9999-999999999999', CURRENT_DATE - INTERVAL '9 days', 200, 200, 0, 'beneficiary', 1700, '{"tier": "base", "tierRank": 4}'),
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '9 days', 200, 200, 0, 'protected', 0, '{}'),
  ('33333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '9 days', 200, 200, 0, 'contributor', 0, '{}');

INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  ('99999999-9999-9999-9999-999999999999', CURRENT_DATE - INTERVAL '10 days', 200, 200, 0, 'beneficiary', 10800, '{"tier": "jackpot", "tierRank": 1}'),
  ('44444444-4444-4444-4444-444444444444', CURRENT_DATE - INTERVAL '10 days', 200, 200, 0, 'beneficiary', 5400, '{"tier": "high", "tierRank": 2}'),
  ('77777777-7777-7777-7777-777777777777', CURRENT_DATE - INTERVAL '10 days', 200, 200, 0, 'beneficiary', 3600, '{"tier": "high", "tierRank": 3}'),
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '10 days', 200, 200, 0, 'beneficiary', 2400, '{"tier": "base", "tierRank": 4}'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', CURRENT_DATE - INTERVAL '10 days', 200, 200, 0, 'beneficiary', 1200, '{"tier": "base", "tierRank": 5}'),
  ('33333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '10 days', 200, 200, 0, 'beneficiary', 800, '{"tier": "base", "tierRank": 6}'),
  ('22222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '10 days', 200, 200, 0, 'protected', 0, '{}'),
  ('55555555-5555-5555-5555-555555555555', CURRENT_DATE - INTERVAL '10 days', 200, 200, 0, 'contributor', 0, '{}');

INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  ('44444444-4444-4444-4444-444444444444', CURRENT_DATE - INTERVAL '11 days', 200, 200, 0, 'beneficiary', 7200, '{"tier": "jackpot", "tierRank": 1}'),
  ('88888888-8888-8888-8888-888888888888', CURRENT_DATE - INTERVAL '11 days', 200, 200, 0, 'beneficiary', 3800, '{"tier": "high", "tierRank": 2}'),
  ('22222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '11 days', 200, 200, 0, 'beneficiary', 2600, '{"tier": "base", "tierRank": 3}'),
  ('55555555-5555-5555-5555-555555555555', CURRENT_DATE - INTERVAL '11 days', 200, 200, 0, 'beneficiary', 1800, '{"tier": "base", "tierRank": 4}'),
  ('66666666-6666-6666-6666-666666666666', CURRENT_DATE - INTERVAL '11 days', 200, 200, 0, 'protected', 0, '{}'),
  ('77777777-7777-7777-7777-777777777777', CURRENT_DATE - INTERVAL '11 days', 200, 200, 0, 'contributor', 0, '{}');

INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '12 days', 200, 200, 0, 'beneficiary', 9000, '{"tier": "jackpot", "tierRank": 1}'),
  ('55555555-5555-5555-5555-555555555555', CURRENT_DATE - INTERVAL '12 days', 200, 200, 0, 'beneficiary', 4600, '{"tier": "high", "tierRank": 2}'),
  ('99999999-9999-9999-9999-999999999999', CURRENT_DATE - INTERVAL '12 days', 200, 200, 0, 'beneficiary', 3000, '{"tier": "high", "tierRank": 3}'),
  ('33333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '12 days', 200, 200, 0, 'beneficiary', 2000, '{"tier": "base", "tierRank": 4}'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', CURRENT_DATE - INTERVAL '12 days', 200, 200, 0, 'beneficiary', 1400, '{"tier": "base", "tierRank": 5}'),
  ('44444444-4444-4444-4444-444444444444', CURRENT_DATE - INTERVAL '12 days', 200, 200, 0, 'protected', 0, '{}'),
  ('66666666-6666-6666-6666-666666666666', CURRENT_DATE - INTERVAL '12 days', 200, 200, 0, 'contributor', 0, '{}');

INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  ('66666666-6666-6666-6666-666666666666', CURRENT_DATE - INTERVAL '13 days', 200, 200, 0, 'beneficiary', 7600, '{"tier": "jackpot", "tierRank": 1}'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', CURRENT_DATE - INTERVAL '13 days', 200, 200, 0, 'beneficiary', 4000, '{"tier": "high", "tierRank": 2}'),
  ('77777777-7777-7777-7777-777777777777', CURRENT_DATE - INTERVAL '13 days', 200, 200, 0, 'beneficiary', 2600, '{"tier": "high", "tierRank": 3}'),
  ('22222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '13 days', 200, 200, 0, 'beneficiary', 1600, '{"tier": "base", "tierRank": 4}'),
  ('44444444-4444-4444-4444-444444444444', CURRENT_DATE - INTERVAL '13 days', 200, 200, 0, 'beneficiary', 1000, '{"tier": "base", "tierRank": 5}'),
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '13 days', 200, 200, 0, 'protected', 0, '{}'),
  ('33333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '13 days', 200, 200, 0, 'contributor', 0, '{}');

INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  ('33333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '14 days', 200, 200, 0, 'beneficiary', 12500, '{"tier": "jackpot", "tierRank": 1}'),
  ('88888888-8888-8888-8888-888888888888', CURRENT_DATE - INTERVAL '14 days', 200, 200, 0, 'beneficiary', 6500, '{"tier": "high", "tierRank": 2}'),
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '14 days', 200, 200, 0, 'beneficiary', 4200, '{"tier": "high", "tierRank": 3}'),
  ('55555555-5555-5555-5555-555555555555', CURRENT_DATE - INTERVAL '14 days', 200, 200, 0, 'beneficiary', 2800, '{"tier": "base", "tierRank": 4}'),
  ('66666666-6666-6666-6666-666666666666', CURRENT_DATE - INTERVAL '14 days', 200, 200, 0, 'beneficiary', 1600, '{"tier": "base", "tierRank": 5}'),
  ('99999999-9999-9999-9999-999999999999', CURRENT_DATE - INTERVAL '14 days', 200, 200, 0, 'beneficiary', 800, '{"tier": "base", "tierRank": 6}'),
  ('22222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '14 days', 200, 200, 0, 'beneficiary', 300, '{"tier": "base", "tierRank": 7}'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', CURRENT_DATE - INTERVAL '14 days', 200, 200, 0, 'beneficiary', 100, '{"tier": "base", "tierRank": 8}'),
  ('44444444-4444-4444-4444-444444444444', CURRENT_DATE - INTERVAL '14 days', 200, 200, 0, 'protected', 0, '{}'),
  ('77777777-7777-7777-7777-777777777777', CURRENT_DATE - INTERVAL '14 days', 200, 200, 0, 'contributor', 0, '{}');

-- Week 3 entries (Days 15-21)
INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  ('88888888-8888-8888-8888-888888888888', CURRENT_DATE - INTERVAL '15 days', 200, 200, 0, 'beneficiary', 8800, '{"tier": "jackpot", "tierRank": 1}'),
  ('44444444-4444-4444-4444-444444444444', CURRENT_DATE - INTERVAL '15 days', 200, 200, 0, 'beneficiary', 4400, '{"tier": "high", "tierRank": 2}'),
  ('66666666-6666-6666-6666-666666666666', CURRENT_DATE - INTERVAL '15 days', 200, 200, 0, 'beneficiary', 3000, '{"tier": "high", "tierRank": 3}'),
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '15 days', 200, 200, 0, 'beneficiary', 1800, '{"tier": "base", "tierRank": 4}'),
  ('77777777-7777-7777-7777-777777777777', CURRENT_DATE - INTERVAL '15 days', 200, 200, 0, 'beneficiary', 1200, '{"tier": "base", "tierRank": 5}'),
  ('22222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '15 days', 200, 200, 0, 'protected', 0, '{}'),
  ('33333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '15 days', 200, 200, 0, 'contributor', 0, '{}');

INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', CURRENT_DATE - INTERVAL '16 days', 200, 200, 0, 'beneficiary', 5800, '{"tier": "jackpot", "tierRank": 1}'),
  ('99999999-9999-9999-9999-999999999999', CURRENT_DATE - INTERVAL '16 days', 200, 200, 0, 'beneficiary', 3400, '{"tier": "high", "tierRank": 2}'),
  ('33333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '16 days', 200, 200, 0, 'beneficiary', 3200, '{"tier": "base", "tierRank": 3}'),
  ('55555555-5555-5555-5555-555555555555', CURRENT_DATE - INTERVAL '16 days', 200, 200, 0, 'protected', 0, '{}'),
  ('66666666-6666-6666-6666-666666666666', CURRENT_DATE - INTERVAL '16 days', 200, 200, 0, 'contributor', 0, '{}');

INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  ('55555555-5555-5555-5555-555555555555', CURRENT_DATE - INTERVAL '17 days', 200, 200, 0, 'beneficiary', 9800, '{"tier": "jackpot", "tierRank": 1}'),
  ('22222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '17 days', 200, 200, 0, 'beneficiary', 5000, '{"tier": "high", "tierRank": 2}'),
  ('77777777-7777-7777-7777-777777777777', CURRENT_DATE - INTERVAL '17 days', 200, 200, 0, 'beneficiary', 3200, '{"tier": "high", "tierRank": 3}'),
  ('88888888-8888-8888-8888-888888888888', CURRENT_DATE - INTERVAL '17 days', 200, 200, 0, 'beneficiary', 2000, '{"tier": "base", "tierRank": 4}'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', CURRENT_DATE - INTERVAL '17 days', 200, 200, 0, 'beneficiary', 1000, '{"tier": "base", "tierRank": 5}'),
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '17 days', 200, 200, 0, 'beneficiary', 600, '{"tier": "base", "tierRank": 6}'),
  ('33333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '17 days', 200, 200, 0, 'protected', 0, '{}'),
  ('44444444-4444-4444-4444-444444444444', CURRENT_DATE - INTERVAL '17 days', 200, 200, 0, 'contributor', 0, '{}');

INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  ('77777777-7777-7777-7777-777777777777', CURRENT_DATE - INTERVAL '18 days', 200, 200, 0, 'beneficiary', 7400, '{"tier": "jackpot", "tierRank": 1}'),
  ('33333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '18 days', 200, 200, 0, 'beneficiary', 3800, '{"tier": "high", "tierRank": 2}'),
  ('66666666-6666-6666-6666-666666666666', CURRENT_DATE - INTERVAL '18 days', 200, 200, 0, 'beneficiary', 2800, '{"tier": "base", "tierRank": 3}'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', CURRENT_DATE - INTERVAL '18 days', 200, 200, 0, 'beneficiary', 2000, '{"tier": "base", "tierRank": 4}'),
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '18 days', 200, 200, 0, 'protected', 0, '{}'),
  ('22222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '18 days', 200, 200, 0, 'contributor', 0, '{}');

INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  ('22222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '19 days', 200, 200, 0, 'beneficiary', 10400, '{"tier": "jackpot", "tierRank": 1}'),
  ('44444444-4444-4444-4444-444444444444', CURRENT_DATE - INTERVAL '19 days', 200, 200, 0, 'beneficiary', 5200, '{"tier": "high", "tierRank": 2}'),
  ('99999999-9999-9999-9999-999999999999', CURRENT_DATE - INTERVAL '19 days', 200, 200, 0, 'beneficiary', 3400, '{"tier": "high", "tierRank": 3}'),
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '19 days', 200, 200, 0, 'beneficiary', 2200, '{"tier": "base", "tierRank": 4}'),
  ('55555555-5555-5555-5555-555555555555', CURRENT_DATE - INTERVAL '19 days', 200, 200, 0, 'beneficiary', 1200, '{"tier": "base", "tierRank": 5}'),
  ('88888888-8888-8888-8888-888888888888', CURRENT_DATE - INTERVAL '19 days', 200, 200, 0, 'beneficiary', 800, '{"tier": "base", "tierRank": 6}'),
  ('33333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '19 days', 200, 200, 0, 'protected', 0, '{}'),
  ('66666666-6666-6666-6666-666666666666', CURRENT_DATE - INTERVAL '19 days', 200, 200, 0, 'contributor', 0, '{}');

INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  ('99999999-9999-9999-9999-999999999999', CURRENT_DATE - INTERVAL '20 days', 200, 200, 0, 'beneficiary', 6800, '{"tier": "jackpot", "tierRank": 1}'),
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '20 days', 200, 200, 0, 'beneficiary', 3600, '{"tier": "high", "tierRank": 2}'),
  ('66666666-6666-6666-6666-666666666666', CURRENT_DATE - INTERVAL '20 days', 200, 200, 0, 'beneficiary', 2400, '{"tier": "base", "tierRank": 3}'),
  ('77777777-7777-7777-7777-777777777777', CURRENT_DATE - INTERVAL '20 days', 200, 200, 0, 'beneficiary', 1800, '{"tier": "base", "tierRank": 4}'),
  ('22222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '20 days', 200, 200, 0, 'protected', 0, '{}'),
  ('33333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '20 days', 200, 200, 0, 'contributor', 0, '{}');

INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
  ('44444444-4444-4444-4444-444444444444', CURRENT_DATE - INTERVAL '21 days', 200, 200, 0, 'beneficiary', 11000, '{"tier": "jackpot", "tierRank": 1}'),
  ('55555555-5555-5555-5555-555555555555', CURRENT_DATE - INTERVAL '21 days', 200, 200, 0, 'beneficiary', 5600, '{"tier": "high", "tierRank": 2}'),
  ('88888888-8888-8888-8888-888888888888', CURRENT_DATE - INTERVAL '21 days', 200, 200, 0, 'beneficiary', 3600, '{"tier": "high", "tierRank": 3}'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', CURRENT_DATE - INTERVAL '21 days', 200, 200, 0, 'beneficiary', 2400, '{"tier": "base", "tierRank": 4}'),
  ('33333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '21 days', 200, 200, 0, 'beneficiary', 1400, '{"tier": "base", "tierRank": 5}'),
  ('66666666-6666-6666-6666-666666666666', CURRENT_DATE - INTERVAL '21 days', 200, 200, 0, 'beneficiary', 700, '{"tier": "base", "tierRank": 6}'),
  ('99999999-9999-9999-9999-999999999999', CURRENT_DATE - INTERVAL '21 days', 200, 200, 0, 'beneficiary', 300, '{"tier": "base", "tierRank": 7}'),
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '21 days', 200, 200, 0, 'protected', 0, '{}'),
  ('22222222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '21 days', 200, 200, 0, 'protected', 0, '{}'),
  ('77777777-7777-7777-7777-777777777777', CURRENT_DATE - INTERVAL '21 days', 200, 200, 0, 'contributor', 0, '{}');