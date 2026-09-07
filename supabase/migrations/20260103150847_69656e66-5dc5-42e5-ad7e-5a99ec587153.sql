-- Create 200 Test Users for Ghost Mode Distribution
-- Using similar structure to existing test users (Chioma Adebayo, Fatima Bello, etc.)

DO $$
DECLARE
  i INTEGER;
  v_user_id UUID;
  v_first_names TEXT[] := ARRAY['Adaeze', 'Blessing', 'Chiamaka', 'Damilola', 'Emeka', 'Funke', 'Gbenga', 'Halima', 'Ibrahim', 'Jumoke', 'Kunle', 'Ladi', 'Musa', 'Ngozi', 'Oluwaseun', 'Patience', 'Quadri', 'Rashida', 'Sade', 'Tunde', 'Uche', 'Victor', 'Wale', 'Yetunde', 'Zainab', 'Aisha', 'Bola', 'Chidi', 'Doyin', 'Ese', 'Femi', 'Grace', 'Hassan', 'Ifeoma', 'James', 'Kemi', 'Lanre', 'Mary', 'Nkechi', 'Olu'];
  v_last_names TEXT[] := ARRAY['Adebayo', 'Bello', 'Okonkwo', 'Okafor', 'Ibrahim', 'Yusuf', 'Abubakar', 'Mohammed', 'Aliyu', 'Suleiman', 'Ogundimu', 'Adeleke', 'Bakare', 'Fashola', 'Akande', 'Oyedele', 'Ogundipe', 'Afolabi', 'Oyelaran', 'Adeyemi', 'Nnamdi', 'Eze', 'Okoro', 'Uzoma', 'Chukwu', 'Igwe', 'Nwachukwu', 'Obinna', 'Uzodinma', 'Obi', 'Aminu', 'Garba', 'Malam', 'Danjuma', 'Kabiru', 'Lawal', 'Shehu', 'Tanko', 'Yakubu', 'Zubairu'];
  v_full_name TEXT;
  v_referral_code TEXT;
BEGIN
  FOR i IN 1..200 LOOP
    -- Generate UUID with pattern 11112222-3333-4444-5555-[6 digit number padded]
    v_user_id := ('11112222-3333-4444-5555-' || LPAD(i::TEXT, 12, '0'))::UUID;
    
    -- Generate realistic Nigerian name
    v_full_name := v_first_names[1 + (i % array_length(v_first_names, 1))] || ' ' || v_last_names[1 + ((i / 2) % array_length(v_last_names, 1))];
    
    -- Generate unique referral code
    v_referral_code := 'ghost' || LPAD(i::TEXT, 3, '0');
    
    -- Insert profile (skip if already exists)
    INSERT INTO public.profiles (
      id,
      full_name,
      referral_code,
      is_member,
      is_name_locked,
      referred_by_code,
      created_at
    ) VALUES (
      v_user_id,
      v_full_name,
      v_referral_code,
      true,
      true,
      'SYSTEM',
      NOW() - (random() * interval '30 days')
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Insert user_balances (skip if already exists)
    INSERT INTO public.user_balances (
      user_id,
      earnings_balance,
      deposit_balance,
      credits_balance
    ) VALUES (
      v_user_id,
      (random() * 5000)::NUMERIC(12,2),
      (random() * 2000)::NUMERIC(12,2),
      (random() * 400)::NUMERIC(12,2)
    )
    ON CONFLICT (user_id) DO NOTHING;
    
  END LOOP;
END $$;