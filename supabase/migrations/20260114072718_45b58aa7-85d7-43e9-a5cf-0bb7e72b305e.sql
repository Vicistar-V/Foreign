
-- Update ALL users referred by Victor Ogazie (all case variations) to Victor Chiemerie
UPDATE profiles
SET referred_by_code = 'victorchiemerie'
WHERE LOWER(referred_by_code) LIKE 'victorogazie%';

-- Also update any pending referral bonuses from Victor Ogazie to Victor Chiemerie
UPDATE pending_referral_bonuses
SET referrer_id = 'b23d5dd6-3f5d-49a7-8ad9-62a1feb17dc2'
WHERE referrer_id = '5d7a5ea2-034c-4665-86b6-816d81dc0330';
