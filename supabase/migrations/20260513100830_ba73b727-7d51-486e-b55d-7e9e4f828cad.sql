INSERT INTO public.transactions (user_id, transaction_type, wallet_type, amount, status, description)
VALUES ('545f631e-40fd-4cba-a718-bd8d9c811e2b', 'withdrawal', 'earnings', 4850, 'completed', 'Withdrawal to bank account');

UPDATE public.cached_balances
SET earnings_balance = 2670, last_updated = now()
WHERE user_id = '545f631e-40fd-4cba-a718-bd8d9c811e2b';

INSERT INTO public.cached_balances (user_id, earnings_balance, deposit_balance)
SELECT '545f631e-40fd-4cba-a718-bd8d9c811e2b', 2670, 0
WHERE NOT EXISTS (SELECT 1 FROM public.cached_balances WHERE user_id = '545f631e-40fd-4cba-a718-bd8d9c811e2b');