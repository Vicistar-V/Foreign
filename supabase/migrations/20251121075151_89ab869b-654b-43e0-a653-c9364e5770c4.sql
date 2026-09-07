-- Enable realtime for critical tables
ALTER TABLE public.user_balances REPLICA IDENTITY FULL;
ALTER TABLE public.drop_entries REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.platform_config REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_balances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drop_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_config;