-- Copy avatar URLs from original test users to ghost winners (gender-matched)

-- Female: Adaeze Adebayo ← Chioma Adebayo
UPDATE public.profiles 
SET avatar_url = (SELECT avatar_url FROM public.profiles WHERE full_name = 'Chioma Adebayo' AND referred_by_code != 'SYSTEM' LIMIT 1)
WHERE full_name = 'Adaeze Adebayo' AND referred_by_code = 'SYSTEM';

-- Female: Adaeze Nnamdi ← Fatima Bello
UPDATE public.profiles 
SET avatar_url = (SELECT avatar_url FROM public.profiles WHERE full_name = 'Fatima Bello' AND referred_by_code != 'SYSTEM' LIMIT 1)
WHERE full_name = 'Adaeze Nnamdi' AND referred_by_code = 'SYSTEM';

-- Female: Blessing Nnamdi ← Ngozi Eze
UPDATE public.profiles 
SET avatar_url = (SELECT avatar_url FROM public.profiles WHERE full_name = 'Ngozi Eze' AND referred_by_code != 'SYSTEM' LIMIT 1)
WHERE full_name = 'Blessing Nnamdi' AND referred_by_code = 'SYSTEM';

-- Female: Chiamaka Eze ← Precious Udoh
UPDATE public.profiles 
SET avatar_url = (SELECT avatar_url FROM public.profiles WHERE full_name = 'Precious Udoh' AND referred_by_code != 'SYSTEM' LIMIT 1)
WHERE full_name = 'Chiamaka Eze' AND referred_by_code = 'SYSTEM';

-- Female: Grace Lawal ← Yetunde Bakare
UPDATE public.profiles 
SET avatar_url = (SELECT avatar_url FROM public.profiles WHERE full_name = 'Yetunde Bakare' AND referred_by_code != 'SYSTEM' LIMIT 1)
WHERE full_name = 'Grace Lawal' AND referred_by_code = 'SYSTEM';

-- Male: Damilola Eze ← Samuel Nnamdi
UPDATE public.profiles 
SET avatar_url = (SELECT avatar_url FROM public.profiles WHERE full_name = 'Samuel Nnamdi' AND referred_by_code != 'SYSTEM' LIMIT 1)
WHERE full_name = 'Damilola Eze' AND referred_by_code = 'SYSTEM';

-- Male: Femi Oyedele ← Emeka Okonkwo
UPDATE public.profiles 
SET avatar_url = (SELECT avatar_url FROM public.profiles WHERE full_name = 'Emeka Okonkwo' AND referred_by_code != 'SYSTEM' LIMIT 1)
WHERE full_name = 'Femi Oyedele' AND referred_by_code = 'SYSTEM';