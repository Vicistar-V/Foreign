ALTER TYPE public.wallet_type ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'task_earning';
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'task_unlock';