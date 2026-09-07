DO $$
DECLARE u uuid := '6e5f1c0d-a55c-47d9-9c0a-65e94d61d6c2';
        s uuid; first_spot uuid; i int; base int;
BEGIN
  ALTER TABLE public.profiles DISABLE TRIGGER USER;
  UPDATE public.profiles
     SET is_member = true,
         activated_at = now() - interval '6 days',
         has_seen_explainer = true,
         is_name_locked = true,
         avatar_url = 'http://localhost:8080/images/demo-person.jpg'
   WHERE id = u;
  ALTER TABLE public.profiles ENABLE TRIGGER USER;

  INSERT INTO public.user_pin_secrets (user_id, pin_hash, updated_at)
  VALUES (u, crypt('2468', gen_salt('bf')), now())
  ON CONFLICT (user_id) DO UPDATE SET pin_hash = EXCLUDED.pin_hash;

  INSERT INTO public.withdrawal_accounts (user_id, bank_name, bank_code, account_number, account_name, is_verified, is_primary)
  VALUES (u, 'Opay', '999992', '8067451209', 'CHINEDU EMEKA OKAFOR', true, true)
  ON CONFLICT DO NOTHING;

  DELETE FROM public.drops WHERE user_id = u;
  DELETE FROM public.spots WHERE user_id = u;

  FOR i IN 1..5 LOOP
    INSERT INTO public.spots (user_id, spot_name, status, is_extension)
    VALUES (u, 'Ad Share ' || i, 'active', i > 1)
    RETURNING id INTO s;
    IF i = 1 THEN first_spot := s; END IF;
  END LOOP;

  SELECT COALESCE(MAX(position), 0) INTO base FROM public.drops;

  INSERT INTO public.drops (user_id, spot_id, position, target_amount, fill_amount, status, source_type, is_settled, created_at)
  VALUES (u, first_spot, base + 1, 50000, 31200, 'filling', 'new', false, now() - interval '6 days');

  INSERT INTO public.cached_balances (user_id, earnings_balance, deposit_balance, pending_balance, last_updated)
  VALUES (u, 18800, 0, 31200, now())
  ON CONFLICT (user_id) DO UPDATE
     SET earnings_balance = EXCLUDED.earnings_balance,
         pending_balance  = EXCLUDED.pending_balance,
         last_updated     = now();
END $$;