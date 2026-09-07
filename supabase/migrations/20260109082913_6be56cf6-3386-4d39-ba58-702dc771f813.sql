-- Delete the referral broadcast notification for non-members only
DELETE FROM notifications n
USING profiles p
WHERE n.user_id = p.id
  AND n.title = 'Earn Money While You Sleep'
  AND p.is_member = false;