
-- Make original test users with pictures the winners
-- Update their existing entries instead of swapping user_ids

-- Keep Emeka Okonkwo as jackpot winner (already is - ₦5,000)
-- Keep Ngozi Eze as base winner (already is - ₦1,666.67)

-- Make Chioma Adebayo a HIGH tier winner (₦2,500)
UPDATE public.drop_entries 
SET result_status = 'beneficiary', 
    win_amount = 2500.00,
    metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{tier}', '"high"')
WHERE id = '8756d389-6c04-4719-8799-cf14dc91d939';

-- Make Fatima Bello a HIGH tier winner (₦2,500)
UPDATE public.drop_entries 
SET result_status = 'beneficiary', 
    win_amount = 2500.00,
    metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{tier}', '"high"')
WHERE id = '285e0c79-5297-4e29-990e-debeefe858a1';

-- Make Precious Udoh a BASE tier winner (₦1,666.67)
UPDATE public.drop_entries 
SET result_status = 'beneficiary', 
    win_amount = 1666.67,
    metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{tier}', '"base"')
WHERE id = '51837d64-2f7b-4f1f-bde5-3be1c0ef86ae';

-- Make Samuel Nnamdi a BASE tier winner (₦1,666.67)
UPDATE public.drop_entries 
SET result_status = 'beneficiary', 
    win_amount = 1666.67,
    metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{tier}', '"base"')
WHERE id = 'fffb705f-1f0c-4b35-8962-10fcc6b7d096';

-- Make Yetunde Bakare a BASE tier winner (₦1,666.67)
UPDATE public.drop_entries 
SET result_status = 'beneficiary', 
    win_amount = 1666.67,
    metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{tier}', '"base"')
WHERE id = '41cbfb06-7c40-4a13-83bb-de5b953451e2';

-- Mark ALL ghost users as contributors (remove from winners)
UPDATE public.drop_entries 
SET result_status = 'contributor', 
    win_amount = 0
WHERE drop_date = CURRENT_DATE
AND result_status = 'beneficiary'
AND user_id NOT IN (
  '11111111-1111-1111-1111-111111111111', -- Chioma Adebayo
  '22222222-2222-2222-2222-222222222222', -- Emeka Okonkwo
  '33333333-3333-3333-3333-333333333333', -- Fatima Bello
  '55555555-5555-5555-5555-555555555555', -- Ngozi Eze
  '77777777-7777-7777-7777-777777777777', -- Precious Udoh
  '88888888-8888-8888-8888-888888888888', -- Samuel Nnamdi
  '99999999-9999-9999-9999-999999999999'  -- Yetunde Bakare
);
