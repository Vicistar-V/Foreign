
-- Update Chinedu's existing entry to beneficiary with win amount
UPDATE public.drop_entries 
SET result_status = 'beneficiary', win_amount = 520, metadata = '{"tier": "gold", "tierRank": 1}'::jsonb
WHERE id = 'c0a3a997-cdd9-45d9-bd27-a8b795fcbc1c';

-- Add fake user entries
INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, metadata) VALUES
('11111111-1111-1111-1111-111111111111', '2025-12-27', 200, 200, 0, 'beneficiary', 2278, '{"tier": "gold", "tierRank": 2}'::jsonb),
('22222222-2222-2222-2222-222222222222', '2025-12-27', 200, 200, 0, 'beneficiary', 3450, '{"tier": "gold", "tierRank": 3}'::jsonb),
('44444444-4444-4444-4444-444444444444', '2025-12-27', 200, 200, 0, 'beneficiary', 4100, '{"tier": "silver", "tierRank": 1}'::jsonb),
('55555555-5555-5555-5555-555555555555', '2025-12-27', 200, 200, 0, 'beneficiary', 5200, '{"tier": "silver", "tierRank": 2}'::jsonb),
('66666666-6666-6666-6666-666666666666', '2025-12-27', 200, 200, 0, 'beneficiary', 6000, '{"tier": "silver", "tierRank": 3}'::jsonb);
