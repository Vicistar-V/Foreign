-- Delete all ghost users (UUID pattern 11112222-3333-4444-5555-*)
-- First delete related records to avoid foreign key constraints

-- Delete from user_balances
DELETE FROM public.user_balances 
WHERE user_id::text LIKE '11112222-3333-4444-5555%';

-- Delete from transactions
DELETE FROM public.transactions 
WHERE user_id::text LIKE '11112222-3333-4444-5555%';

-- Delete from drop_entries
DELETE FROM public.drop_entries 
WHERE user_id::text LIKE '11112222-3333-4444-5555%';

-- Delete from event_queue
DELETE FROM public.event_queue 
WHERE user_id::text LIKE '11112222-3333-4444-5555%';

-- Delete from user_roles
DELETE FROM public.user_roles 
WHERE user_id::text LIKE '11112222-3333-4444-5555%';

-- Delete from user_activity_log
DELETE FROM public.user_activity_log 
WHERE user_id::text LIKE '11112222-3333-4444-5555%';

-- Delete from support_tickets
DELETE FROM public.support_tickets 
WHERE user_id::text LIKE '11112222-3333-4444-5555%';

-- Delete from payment_attempts
DELETE FROM public.payment_attempts 
WHERE user_id::text LIKE '11112222-3333-4444-5555%';

-- Delete from withdrawal_accounts
DELETE FROM public.withdrawal_accounts 
WHERE user_id::text LIKE '11112222-3333-4444-5555%';

-- Finally delete the ghost profiles
DELETE FROM public.profiles 
WHERE id::text LIKE '11112222-3333-4444-5555%';