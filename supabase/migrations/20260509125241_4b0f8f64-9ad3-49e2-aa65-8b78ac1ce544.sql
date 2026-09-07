DELETE FROM public.transactions WHERE user_id = '86f8cbbe-0247-4d15-9335-9ea52fbf6bb3' AND transaction_type = 'task_earning';
DELETE FROM public.daily_task WHERE user_id = '86f8cbbe-0247-4d15-9335-9ea52fbf6bb3';
DELETE FROM public.cached_balances WHERE user_id = '86f8cbbe-0247-4d15-9335-9ea52fbf6bb3';