-- Insert broadcast notification for all real users (verified in auth.users)
INSERT INTO notifications (user_id, title, message, notification_type, metadata, link)
SELECT 
  p.id as user_id,
  'Earn Money While You Sleep' as title,
  E'Imagine waking up to extra cash in your wallet - without doing anything.\n\n**Here''s what you get:**\nYou get **₦500** the moment your friend becomes a member.\nPlus, every time they earn, you automatically get **₦20** too.\n\n**One-time bonus (₦500 per friend):**\n- 1 friend = **₦500**\n- 5 friends = **₦2,500**\n- 10 friends = **₦5,000**\n- 50 friends = **₦25,000**\n\n**Recurring bonus (₦20 every time they earn):**\n- 1 friend earning 5x daily = **₦100/day**\n- 5 friends = **₦500/day** (₦15,000/month!)\n- 10 friends = **₦1,000/day** (₦30,000/month!)\n- 50 friends = **₦5,000/day** (₦150,000/month!)\n\nYour friends are already scrolling. Why not let their scrolling pay you too?' as message,
  'broadcast' as notification_type,
  jsonb_build_object(
    'show_as_modal', true,
    'icon_template', 'gift',
    'cta_button_text', 'Start Building Your Earning Team',
    'cta_button_link', '/invite'
  ) as metadata,
  '/invite' as link
FROM profiles p
INNER JOIN auth.users u ON u.id = p.id
WHERE p.is_banned = false;