DELETE FROM public.daily_task WHERE user_id NOT IN (SELECT id FROM public.profiles);
DELETE FROM public.user_tour_progress WHERE user_id NOT IN (SELECT id FROM public.profiles);