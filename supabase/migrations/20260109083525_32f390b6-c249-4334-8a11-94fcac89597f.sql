-- Send activation notification to all non-members
INSERT INTO notifications (user_id, title, message, notification_type, metadata, link)
SELECT 
  p.id as user_id,
  'Your Money Machine is Waiting' as title,
  E'Right now, your spot is reserved but not earning.\n\nPeople who activated yesterday are already seeing money in their wallets today.\n\nOne payment of **₦1,000** and your machine starts working for you - paying you **₦400**, then **₦900**, again and again.\n\nThe longer you wait, the more payouts you''re missing.' as message,
  'activation_reminder' as notification_type,
  jsonb_build_object(
    'show_as_modal', true,
    'icon_template', 'rocket',
    'cta_button_text', 'Activate My Machine',
    'cta_button_link', '/dashboard'
  ) as metadata,
  '/dashboard' as link
FROM profiles p
INNER JOIN auth.users u ON u.id = p.id
WHERE p.is_banned = false
  AND p.is_member = false;