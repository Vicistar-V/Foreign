
-- Reject the latest duplicate submission from Glo-mira
UPDATE mission_completions 
SET 
  status = 'rejected',
  rejection_reason = 'Duplicate screenshot - same image was already submitted and flagged',
  reviewed_at = now()
WHERE id = 'be66314b-861f-4406-8697-e8d95f154d72';

-- Notify her
INSERT INTO notifications (user_id, notification_type, title, message)
VALUES (
  '555c5251-85b4-4e3f-b9a6-e580a5ee3d3f',
  'warning',
  'Task Rejected',
  'Your Friendly Reminder submission was rejected because you used the same screenshot again. Please take new, unique screenshots for each submission.'
);
