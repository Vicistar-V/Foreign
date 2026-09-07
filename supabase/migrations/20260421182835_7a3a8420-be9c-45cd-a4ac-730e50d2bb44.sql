-- Drop dead trigger function from removed mission_completions table
DROP FUNCTION IF EXISTS public.notify_admin_new_mission_submission() CASCADE;

-- Drop any remaining storage RLS policies for the orphan buckets
DROP POLICY IF EXISTS "Users can upload mission proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own mission proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all mission proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own mission proofs" ON storage.objects;
DROP POLICY IF EXISTS "mission-proofs public read" ON storage.objects;
DROP POLICY IF EXISTS "mission-proofs authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "mission-proofs authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload task media" ON storage.objects;
DROP POLICY IF EXISTS "Users can view task media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all task media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own task media" ON storage.objects;
DROP POLICY IF EXISTS "task-media public read" ON storage.objects;
DROP POLICY IF EXISTS "task-media authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "task-media authenticated read" ON storage.objects;