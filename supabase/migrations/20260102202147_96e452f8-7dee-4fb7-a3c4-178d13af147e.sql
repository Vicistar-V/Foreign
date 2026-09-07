
-- Add winner notifications to event_queue for all 4 winners
INSERT INTO event_queue (user_id, event_type, event_data, status)
VALUES 
  -- CLETUS NWACHUKWU - ₦3,500
  ('6ce252d3-a7cd-4f23-9ba2-9e337def27f7', 'winner_alert', '{"amount": 3500, "date": "2026-01-02", "tier": "gold"}', 'pending'),
  -- Chinedu Joseph - ₦2,500
  ('f73e5c41-41cf-4a8a-a64c-1d4aacf5e4f3', 'winner_alert', '{"amount": 2500, "date": "2026-01-02", "tier": "silver"}', 'pending'),
  -- OLORUNYOMI DAYO - ₦2,000
  ('ed5061b7-c65f-4115-927b-da09f4faffa9', 'winner_alert', '{"amount": 2000, "date": "2026-01-02", "tier": "bronze"}', 'pending'),
  -- Ogechi Aruocha - ₦2,000
  ('fc595f77-07f8-4e93-b0d5-cc73dc9a0f19', 'winner_alert', '{"amount": 2000, "date": "2026-01-02", "tier": "bronze"}', 'pending');
