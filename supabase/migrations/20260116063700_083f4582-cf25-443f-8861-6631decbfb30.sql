-- ===============================
-- PHASE 1: UPDATE EXISTING MISSIONS WITH NEW PRICING & REQUIREMENTS
-- ===============================

-- 1. WhatsApp Status Share: Keep ₦100, update instructions for 20 views minimum and 12-24 hours
UPDATE public.missions 
SET 
  description = 'Post our flyer to your WhatsApp Status for 12-24 hours. Must get at least 20 views to earn ₦100!',
  instructions = '1. Save the flyer shown below
2. Post it to your WhatsApp Status
3. Keep it up for at least 12 hours (24 hours is best)
4. Wait until you have at least 20 views
5. Take a screenshot showing 20+ view count
6. Upload the screenshot here',
  updated_at = now()
WHERE id = 'd7018eb5-1621-487f-86c8-28264741fe46';

-- 2. Join WhatsApp Group: Lower to ₦20 (they benefit from updates, so lower value)
UPDATE public.missions 
SET 
  reward_amount = 20,
  description = 'Join our official WhatsApp group for updates. One-time ₦20 reward!',
  instructions = '1. Click the WhatsApp group link below
2. Join the group
3. Take a screenshot showing you are a member
4. Upload the screenshot here',
  updated_at = now()
WHERE id = '4d62d597-4a8f-47ee-bd01-0737177c51c1';

-- 3. Twitter/X Share: Keep ₦150, require tagging #Viketa
UPDATE public.missions 
SET 
  description = 'Tweet about Viketa with #Viketa hashtag and earn ₦150. Tag us for verification!',
  instructions = '1. Go to X (Twitter)
2. Create a post about Viketa
3. You MUST include #Viketa and tag @ViketaApp
4. Say something about earning money or your experience
5. Copy the link to your tweet
6. Paste the link here',
  updated_at = now()
WHERE id = '279603b3-0a03-41b3-8ae9-1715492ea7d6';

-- 4. TikTok Video: Increase to ₦500, require 24 hours up
UPDATE public.missions 
SET 
  reward_amount = 500,
  description = 'Make a TikTok about Viketa and earn ₦500! Video must stay up for 24 hours.',
  instructions = '1. Create a short video about Viketa (15-60 seconds)
2. Talk about how you earn money on the platform
3. Use hashtags #Viketa #EarnOnline #NigeriaMoney
4. Post the video and keep it up for at least 24 hours
5. Copy the TikTok link
6. Paste the link here
Note: We check that videos stay up. Deleted videos = no payment!',
  updated_at = now()
WHERE id = 'cce92bdc-08ed-4e2f-9a40-dddec842a875';

-- 5. Facebook Follow: Keep ₦50 (low impact but okay)
-- No changes needed for this one

-- ===============================
-- PHASE 2: ADD NEW POWER TASKS
-- ===============================

-- New Task 1: "The Recovery Agent" - Post to Facebook Money Groups (₦200)
INSERT INTO public.missions (
  name,
  description,
  instructions,
  mission_type,
  reward_amount,
  daily_limit,
  lifetime_limit,
  requires_proof,
  proof_type,
  icon_name,
  is_active,
  sort_order
) VALUES (
  'Post to Money Group',
  'Share your withdrawal proof in a "Make Money Online" Facebook group and earn ₦200!',
  '1. Go to any "Make Money Online" Facebook group
2. Create a post sharing your Viketa experience or withdrawal
3. Include the Viketa referral link or our page link
4. Wait for the post to be approved/visible in the group
5. Take a screenshot of your post showing it is live in the group
6. Upload the screenshot here

Best groups: "Make Money Nigeria", "Online Business Nigeria", "Side Hustle Nigeria"',
  'facebook_share',
  200,
  1,
  NULL,
  true,
  'screenshot',
  'facebook',
  true,
  15
);

-- New Task 2: "The Status Comment" - Comment on Admin Posts (₦50)  
INSERT INTO public.missions (
  name,
  description,
  instructions,
  mission_type,
  reward_amount,
  daily_limit,
  lifetime_limit,
  requires_proof,
  proof_type,
  icon_name,
  is_active,
  sort_order
) VALUES (
  'Comment on Our Post',
  'Leave a comment on our latest social media post saying "Paid" or "Verified" - earn ₦50!',
  '1. Go to our latest post (Facebook, Instagram, or Twitter/X)
2. Leave a meaningful comment like "Paid ✅", "Verified!", or share your experience
3. Make sure your comment is visible
4. Take a screenshot showing your comment on our post
5. Upload the screenshot here

This helps new people see that Viketa really pays!',
  'facebook_share',
  50,
  1,
  NULL,
  true,
  'screenshot',
  'message-circle',
  true,
  20
);

-- ===============================
-- PHASE 3: REORDER MISSIONS BY PRIORITY (Most Valuable = New Users)
-- ===============================

-- WhatsApp Status (high value - friends see it) - Top priority
UPDATE public.missions SET sort_order = 1 WHERE id = 'd7018eb5-1621-487f-86c8-28264741fe46';

-- Twitter Post (high virality) - Second priority  
UPDATE public.missions SET sort_order = 2 WHERE id = '279603b3-0a03-41b3-8ae9-1715492ea7d6';

-- Post to Money Group (targeted new users) - Third priority
UPDATE public.missions SET sort_order = 3 WHERE name = 'Post to Money Group';

-- TikTok Video (high effort, high reward) - Fourth priority
UPDATE public.missions SET sort_order = 4 WHERE id = 'cce92bdc-08ed-4e2f-9a40-dddec842a875';

-- Instagram Share - Fifth priority
UPDATE public.missions SET sort_order = 5 WHERE id = 'accc8b15-d7cc-4ce1-a318-fcb39577c120';

-- YouTube Short - Sixth priority
UPDATE public.missions SET sort_order = 6 WHERE id = 'fbe1fa3d-bd73-46b2-b03a-5abcff7d289d';

-- Comment on Our Post (social proof) - Seventh priority
UPDATE public.missions SET sort_order = 7 WHERE name = 'Comment on Our Post';

-- Facebook Follow (low impact) - Eighth priority
UPDATE public.missions SET sort_order = 8 WHERE id = '940024d7-e63c-413c-b166-8c84f0673bef';

-- Join WhatsApp Group (they benefit themselves) - Last priority
UPDATE public.missions SET sort_order = 9 WHERE id = '4d62d597-4a8f-47ee-bd01-0737177c51c1';