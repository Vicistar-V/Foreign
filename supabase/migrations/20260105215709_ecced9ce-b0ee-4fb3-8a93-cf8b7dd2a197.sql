-- Drop the duplicate function with the alternative parameter order
DROP FUNCTION IF EXISTS public.atomic_admin_credit(_admin_id uuid, _user_id uuid, _wallet_type wallet_type, _amount numeric, _reason text);

-- Keep only the one matching our edge function call order:
-- (_user_id, _amount, _wallet_type, _reason, _admin_id)