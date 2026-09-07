-- Rename "The Nudge (Recovery)" to something simpler that everyone understands
UPDATE missions 
SET 
  name = 'Friendly Reminder',
  description = 'Message a friend who signed up but hasn''t joined yet. Send them a friendly reminder to complete their registration!',
  instructions = '1. Go to your Team page to see friends who haven''t joined yet
2. Send them a WhatsApp or SMS message reminding them to sign up
3. Take a screenshot of your message
4. Upload the screenshot here to earn ₦50!'
WHERE name = 'The Nudge (Recovery)';