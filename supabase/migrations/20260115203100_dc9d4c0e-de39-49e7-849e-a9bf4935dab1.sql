-- Update WhatsApp Status Share task with flyer and complete data
UPDATE missions SET 
  media_url = '/images/viketa-flyer-status.png',
  proof_type = 'screenshot',
  max_completions = 500,
  reward_amount = 100,
  daily_limit = 1,
  lifetime_limit = NULL,
  description = 'Post our flyer to your WhatsApp Status and earn ₦100. Keep it up for at least 1 hour!',
  instructions = '1. Save the flyer shown below
2. Post it to your WhatsApp Status
3. Wait for at least 10 views
4. Take a screenshot showing the view count
5. Upload the screenshot here'
WHERE id = 'd7018eb5-1621-487f-86c8-28264741fe46';

-- Update Join WhatsApp Group task
UPDATE missions SET 
  media_url = NULL,
  proof_type = 'screenshot',
  max_completions = 1000,
  reward_amount = 50,
  daily_limit = 1,
  lifetime_limit = 1,
  description = 'Join our official WhatsApp group and stay connected. One-time ₦50 reward!',
  instructions = '1. Click the WhatsApp group link in our bio
2. Join the group
3. Take a screenshot showing you are a member
4. Upload the screenshot here'
WHERE id = '4d62d597-4a8f-47ee-bd01-0737177c51c1';

-- Update Follow on Facebook task
UPDATE missions SET 
  media_url = NULL,
  proof_type = 'screenshot',
  max_completions = 1000,
  reward_amount = 50,
  daily_limit = 1,
  lifetime_limit = 1,
  description = 'Follow our Facebook page and like our latest post. One-time ₦50 reward!',
  instructions = '1. Go to our Facebook page (link in bio)
2. Click Follow
3. Like our latest post
4. Take a screenshot showing you follow us
5. Upload the screenshot here'
WHERE id = '940024d7-e63c-413c-b166-8c84f0673bef';

-- Update Join Telegram Channel task
UPDATE missions SET 
  media_url = NULL,
  proof_type = 'screenshot',
  max_completions = 1000,
  reward_amount = 30,
  daily_limit = 1,
  lifetime_limit = 1,
  description = 'Join our Telegram channel for updates. One-time ₦30 reward!',
  instructions = '1. Click the Telegram link in our bio
2. Join the channel
3. Take a screenshot showing you are a member
4. Upload the screenshot here'
WHERE id = 'ad444c15-a0f3-4d9a-82d3-57d6733fa2a7';