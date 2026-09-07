
-- Step 1: Create drop log for today (no drop entries)
INSERT INTO public.daily_drop_logs (
  drop_date,
  status,
  triggered_by,
  total_participants,
  winners_count,
  protected_count,
  contributors_count,
  total_distributed,
  processed_at,
  metadata
) VALUES (
  '2025-12-27',
  'completed',
  'admin',
  6,
  6,
  0,
  0,
  21548,
  NOW(),
  '{"fake_drop": true, "winners": ["Chinedu Joseph Ibeh", "Emeka Okonkwo", "Olumide Ajayi", "Chioma Adebayo", "Samuel Nnamdi", "Yetunde Bakare"]}'::jsonb
);

-- Step 2: Credit Chinedu Joseph Ibeh ₦520 to earnings wallet (real transaction)
INSERT INTO public.transactions (
  user_id,
  wallet_type,
  amount,
  transaction_type,
  description,
  status,
  metadata
) VALUES (
  'f73e5c41-41cf-4a8a-a64c-1d4aacf5e4f3',
  'earnings',
  520,
  'drop_win',
  'Winner (GOLD Tier) - Daily Distribution 2025-12-27',
  'completed',
  '{"tier": "gold", "tierRank": 1, "drop_date": "2025-12-27"}'::jsonb
);

-- Step 3: Close the drop
UPDATE public.platform_config 
SET is_drop_active = false, updated_at = NOW()
WHERE id = 1;
