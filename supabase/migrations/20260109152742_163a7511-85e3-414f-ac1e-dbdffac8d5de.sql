-- Send broadcast modal notification to Vivian
INSERT INTO public.notifications (
  user_id,
  title,
  message,
  notification_type,
  metadata
) VALUES (
  'dae463a3-767c-46fe-bed7-a9d27f9a4548',
  'Quick Math: Which Path Pays More? 🧮',
  E'We noticed you created a new account using your own referral code after cashing out.\n\nLet''s do the math:\n\n**Self-Referral Path:**\n• You spent ₦2,000 on new account\n• You got ₦500 referral bonus\n• Net cost: ₦1,500 for one-time bonus\n\n**Buying New Machine Path:**\n• Spend ₦2,000 on new machine\n• Earn ₦900 profit per cycle\n• Unlimited cycles = Unlimited earnings\n\nThe new machine pays for itself after just 3 cycles, then it''s pure profit forever! 💰\n\nNo judgement - just wanted you to know for next time. Your machines are still working hard for you!',
  'system',
  '{"show_as_modal": true}'::jsonb
);

-- Also send as regular notification so it stays in her notification list
INSERT INTO public.notifications (
  user_id,
  title,
  message,
  notification_type,
  metadata
) VALUES (
  'dae463a3-767c-46fe-bed7-a9d27f9a4548',
  'Quick Math: Which Path Pays More? 🧮',
  E'We noticed you created a new account using your own referral code. Quick math: Self-referral costs ₦1,500 net for a one-time ₦500 bonus. A new machine costs ₦2,000 but earns ₦900 per cycle forever - pays for itself in 3 cycles! No judgement, just info for next time. 💰',
  'system',
  '{}'::jsonb
);