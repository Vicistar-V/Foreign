
-- Assign avatar URLs to test user winners who don't have profile pictures
-- Copying from real users with similar gender-appropriate names

-- Femi Oyedele (male) - use Stephen Simon's avatar
UPDATE profiles 
SET avatar_url = 'https://sbprvewcfrtazdlcfvxt.supabase.co/storage/v1/object/public/avatars/77305b22-44f1-47e7-b75e-741eeca6a516/avatar.jpg?t=1767463582168'
WHERE id = '11112222-3333-4444-5555-000000000110';

-- Chiamaka Eze (female) - use Yaah meelubari's avatar
UPDATE profiles 
SET avatar_url = 'https://sbprvewcfrtazdlcfvxt.supabase.co/storage/v1/object/public/avatars/e53f29ce-0bb7-4946-81aa-b5349f6378b8/avatar.jpg?t=1767393461882'
WHERE id = '11112222-3333-4444-5555-000000000042';

-- Damilola Eze - use Terver Martins's avatar
UPDATE profiles 
SET avatar_url = 'https://sbprvewcfrtazdlcfvxt.supabase.co/storage/v1/object/public/avatars/2a70eb31-2429-4dd4-991a-cdd00af2647c/avatar.jpg?t=1767463544688'
WHERE id = '11112222-3333-4444-5555-000000000043';

-- Adaeze Adebayo (female) - use Olutola Oluwatoyin's avatar
UPDATE profiles 
SET avatar_url = 'https://sbprvewcfrtazdlcfvxt.supabase.co/storage/v1/object/public/avatars/305bf6c6-e713-4562-bbf0-cdd5a894d4e5/avatar.jpg?t=1767439067677'
WHERE id = '11112222-3333-4444-5555-000000000080';

-- Adaeze Nnamdi (female) - use Akinwumi Temitope's avatar
UPDATE profiles 
SET avatar_url = 'https://sbprvewcfrtazdlcfvxt.supabase.co/storage/v1/object/public/avatars/468f697d-5d5b-4611-8b5d-8ba0e2c17727/avatar.jpg?t=1767442267249'
WHERE id = '11112222-3333-4444-5555-000000000200';

-- Grace Lawal (female) - use Jackson Osayi's avatar
UPDATE profiles 
SET avatar_url = 'https://sbprvewcfrtazdlcfvxt.supabase.co/storage/v1/object/public/avatars/48c3f533-81f6-4070-9ee3-441c4e670237/avatar.jpg?t=1767435086759'
WHERE id = '11112222-3333-4444-5555-000000000071';

-- Blessing Nnamdi (female) - use Omosegbon Omoniyi's avatar
UPDATE profiles 
SET avatar_url = 'https://sbprvewcfrtazdlcfvxt.supabase.co/storage/v1/object/public/avatars/44688ddd-11e6-4d74-8c1b-9f70abf3480b/avatar.jpg?t=1767468382263'
WHERE id = '11112222-3333-4444-5555-000000000041';
