-- Add manual withdrawal mode toggle to platform_config
-- When TRUE, withdrawals skip Flutterwave and wait for admin approval
-- When FALSE (default), withdrawals go through Flutterwave automatically

ALTER TABLE public.platform_config 
ADD COLUMN manual_withdrawal_mode BOOLEAN NOT NULL DEFAULT false;