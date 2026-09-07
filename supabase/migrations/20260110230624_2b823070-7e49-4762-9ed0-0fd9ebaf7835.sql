-- Fix: Create missing pending referral bonuses for existing referred members
-- who haven't completed their first cycle yet

INSERT INTO pending_referral_bonuses (referrer_id, referee_id, amount, status)
SELECT DISTINCT
  referrer.id as referrer_id,
  referee.id as referee_id,
  (SELECT referral_cash_bonus FROM platform_config WHERE id = 1),
  'pending'
FROM profiles referee
JOIN profiles referrer 
  ON LOWER(TRIM(referee.referred_by_code)) = LOWER(TRIM(referrer.referral_code))
WHERE referee.is_member = true
  AND referee.first_cycle_completed_at IS NULL
  AND referee.referred_by_code IS NOT NULL
  AND referee.referred_by_code != ''
  AND referee.referred_by_code != 'SYSTEM'
ON CONFLICT DO NOTHING;