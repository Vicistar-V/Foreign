-- Activate the Cycler System
UPDATE platform_config 
SET cycler_enabled = true,
    referral_payout_trigger = 'ON_FIRST_CYCLE',
    updated_at = now()
WHERE id = 1;