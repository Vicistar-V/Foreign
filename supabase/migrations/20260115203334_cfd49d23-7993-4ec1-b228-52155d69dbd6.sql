-- Add new tasks with link proof type

-- Twitter/X Share task - link proof
INSERT INTO missions (
  name, 
  description, 
  instructions, 
  mission_type, 
  proof_type, 
  media_url,
  reward_amount, 
  daily_limit, 
  lifetime_limit,
  max_completions,
  icon_name,
  sort_order,
  is_active
) VALUES (
  'Share on X (Twitter)',
  'Tweet about Viketa and earn ₦150. Share your tweet link!',
  '1. Go to X (Twitter)
2. Create a post about Viketa - mention @ViketaApp
3. Say something nice about earning money with us
4. Copy the link to your tweet
5. Paste the link here',
  'status_share',
  'link',
  '/images/viketa-flyer-status.png',
  150,
  1,
  NULL,
  300,
  'twitter',
  5,
  true
);

-- TikTok Video task - link proof
INSERT INTO missions (
  name, 
  description, 
  instructions, 
  mission_type, 
  proof_type, 
  media_url,
  reward_amount, 
  daily_limit, 
  lifetime_limit,
  max_completions,
  icon_name,
  sort_order,
  is_active
) VALUES (
  'Post TikTok Video',
  'Make a short TikTok about Viketa and earn ₦300! Big reward for video creators.',
  '1. Create a short video about Viketa (15-60 seconds)
2. Talk about how you earn money on the platform
3. Use hashtags #Viketa #EarnOnline #NigeriaMoney
4. Post the video and copy the link
5. Paste the TikTok link here',
  'status_share',
  'link',
  NULL,
  300,
  1,
  3,
  100,
  'video',
  6,
  true
);

-- Instagram Story Share - link proof  
INSERT INTO missions (
  name, 
  description, 
  instructions, 
  mission_type, 
  proof_type, 
  media_url,
  reward_amount, 
  daily_limit, 
  lifetime_limit,
  max_completions,
  icon_name,
  sort_order,
  is_active
) VALUES (
  'Share on Instagram',
  'Share our flyer on your Instagram story or post and earn ₦100!',
  '1. Save the flyer shown below
2. Post it to your Instagram Story or Feed
3. Tag @ViketaApp in your post
4. Copy the link to your post/story
5. Paste the link here',
  'facebook_share',
  'link',
  '/images/viketa-flyer-status.png',
  100,
  1,
  NULL,
  400,
  'instagram',
  7,
  true
);

-- YouTube Short task - link proof (high reward)
INSERT INTO missions (
  name, 
  description, 
  instructions, 
  mission_type, 
  proof_type, 
  media_url,
  reward_amount, 
  daily_limit, 
  lifetime_limit,
  max_completions,
  icon_name,
  sort_order,
  is_active
) VALUES (
  'Create YouTube Short',
  'Make a YouTube Short about Viketa and earn ₦500! Highest reward for quality content.',
  '1. Create a YouTube Short (under 60 seconds)
2. Explain how Viketa works or your experience
3. Add "Viketa" in the title
4. Post the video and copy the link
5. Paste the YouTube link here',
  'status_share',
  'link',
  NULL,
  500,
  1,
  2,
  50,
  'youtube',
  8,
  true
);