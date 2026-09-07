-- Fix: Update daily_drop_logs to have realistic counts that work with 10 demo users
-- Each day can have max 10 participants total (winners + protected + contributors)

-- First update all the logs to have realistic counts
UPDATE public.daily_drop_logs SET
  total_participants = 10,
  winners_count = 3,
  protected_count = 4,
  contributors_count = 3
WHERE status = 'completed';

-- Now delete any remaining demo drop_entries (in case some exist)
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

-- Recreate drop_entries for each day using different user assignments
DO $$
DECLARE
  log_record RECORD;
  demo_users UUID[] := ARRAY[
    '11111111-1111-1111-1111-111111111111'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid,
    '33333333-3333-3333-3333-333333333333'::uuid,
    '44444444-4444-4444-4444-444444444444'::uuid,
    '55555555-5555-5555-5555-555555555555'::uuid,
    '66666666-6666-6666-6666-666666666666'::uuid,
    '77777777-7777-7777-7777-777777777777'::uuid,
    '88888888-8888-8888-8888-888888888888'::uuid,
    '99999999-9999-9999-9999-999999999999'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ];
  user_idx INT;
  day_offset INT := 0;
  win_amount NUMERIC;
BEGIN
  FOR log_record IN 
    SELECT drop_date, winners_count, protected_count, contributors_count, total_distributed
    FROM public.daily_drop_logs 
    WHERE status = 'completed'
    ORDER BY drop_date DESC
  LOOP
    -- Rotate user assignment based on day to create variety
    user_idx := day_offset;
    
    -- Winners (3 per day): positions 1, 2, 3 get beneficiary status
    -- User 1 - Jackpot winner
    INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, entry_timestamp, metadata)
    VALUES (
      demo_users[((user_idx) % 10) + 1], log_record.drop_date, 200, 180, 20, 'beneficiary',
      ROUND(log_record.total_distributed * 0.45),
      log_record.drop_date + INTERVAL '10 hours',
      jsonb_build_object('tier', 'jackpot', 'tierRank', 1)
    );
    
    -- User 2 - High tier winner
    INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, entry_timestamp, metadata)
    VALUES (
      demo_users[((user_idx + 1) % 10) + 1], log_record.drop_date, 200, 200, 0, 'beneficiary',
      ROUND(log_record.total_distributed * 0.30),
      log_record.drop_date + INTERVAL '10 hours 5 minutes',
      jsonb_build_object('tier', 'high', 'tierRank', 1)
    );
    
    -- User 3 - Base tier winner
    INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, entry_timestamp, metadata)
    VALUES (
      demo_users[((user_idx + 2) % 10) + 1], log_record.drop_date, 200, 180, 20, 'beneficiary',
      ROUND(log_record.total_distributed * 0.15),
      log_record.drop_date + INTERVAL '10 hours 10 minutes',
      jsonb_build_object('tier', 'base', 'tierRank', 1)
    );
    
    -- Protected users (4 per day): positions 4, 5, 6, 7
    INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, entry_timestamp, metadata)
    VALUES (
      demo_users[((user_idx + 3) % 10) + 1], log_record.drop_date, 200, 180, 20, 'protected', 0,
      log_record.drop_date + INTERVAL '11 hours',
      jsonb_build_object('payment_breakdown', jsonb_build_object('credits', 20, 'deposit', 180, 'earnings', 0))
    );
    
    INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, entry_timestamp, metadata)
    VALUES (
      demo_users[((user_idx + 4) % 10) + 1], log_record.drop_date, 200, 200, 0, 'protected', 0,
      log_record.drop_date + INTERVAL '11 hours 5 minutes',
      jsonb_build_object('payment_breakdown', jsonb_build_object('credits', 0, 'deposit', 200, 'earnings', 0))
    );
    
    INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, entry_timestamp, metadata)
    VALUES (
      demo_users[((user_idx + 5) % 10) + 1], log_record.drop_date, 200, 150, 50, 'protected', 0,
      log_record.drop_date + INTERVAL '11 hours 10 minutes',
      jsonb_build_object('payment_breakdown', jsonb_build_object('credits', 50, 'deposit', 150, 'earnings', 0))
    );
    
    INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, entry_timestamp, metadata)
    VALUES (
      demo_users[((user_idx + 6) % 10) + 1], log_record.drop_date, 200, 180, 20, 'protected', 0,
      log_record.drop_date + INTERVAL '11 hours 15 minutes',
      jsonb_build_object('payment_breakdown', jsonb_build_object('credits', 20, 'deposit', 180, 'earnings', 0))
    );
    
    -- Contributors/Pillars (3 per day): positions 8, 9, 10
    INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, entry_timestamp, metadata)
    VALUES (
      demo_users[((user_idx + 7) % 10) + 1], log_record.drop_date, 200, 200, 0, 'contributor', 0,
      log_record.drop_date + INTERVAL '12 hours',
      '{}'::jsonb
    );
    
    INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, entry_timestamp, metadata)
    VALUES (
      demo_users[((user_idx + 8) % 10) + 1], log_record.drop_date, 200, 200, 0, 'contributor', 0,
      log_record.drop_date + INTERVAL '12 hours 5 minutes',
      '{}'::jsonb
    );
    
    INSERT INTO public.drop_entries (user_id, drop_date, total_amount, cash_amount, credit_amount, result_status, win_amount, entry_timestamp, metadata)
    VALUES (
      demo_users[((user_idx + 9) % 10) + 1], log_record.drop_date, 200, 200, 0, 'contributor', 0,
      log_record.drop_date + INTERVAL '12 hours 10 minutes',
      '{}'::jsonb
    );
    
    -- Rotate for next day
    day_offset := day_offset + 1;
  END LOOP;
END $$;