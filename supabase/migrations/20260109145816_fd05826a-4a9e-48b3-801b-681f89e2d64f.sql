
-- Send the referral broadcast to Vivian Ikechi Wike
SELECT create_notification(
  _user_id := 'dae463a3-767c-46fe-bed7-a9d27f9a4548'::uuid,
  _type := 'broadcast',
  _title := 'Earn Money While You Sleep',
  _message := 'Imagine waking up to extra cash in your wallet - without doing anything.

**Here''s what you get:**
You get **₦500** the moment your friend becomes a member.
Plus, every time they earn, you automatically get **₦20** too.

**One-time bonus (₦500 per friend):**
- 1 friend = **₦500**
- 5 friends = **₦2,500**
- 10 friends = **₦5,000**
- 50 friends = **₦25,000**

**Recurring bonus (₦20 every time they earn):**
- 1 friend earning 5x daily = **₦100/day**
- 5 friends = **₦500/day** (₦15,000/month!)
- 10 friends = **₦1,000/day** (₦30,000/month!)
- 50 friends = **₦5,000/day** (₦150,000/month!)

Your friends are already scrolling. Why not let their scrolling pay you too?',
  _metadata := '{"cta_button_link": "/invite", "cta_button_text": "Start Building Your Earning Team", "icon_template": "gift", "show_as_modal": true}'::jsonb
);
