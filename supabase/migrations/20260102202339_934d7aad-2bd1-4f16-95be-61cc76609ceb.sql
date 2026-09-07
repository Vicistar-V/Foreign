-- Create the missing daily_drop_logs entry for 2026-01-02
INSERT INTO daily_drop_logs (
  drop_date,
  status,
  total_participants,
  winners_count,
  protected_count,
  contributors_count,
  total_distributed,
  triggered_by,
  processed_at,
  metadata
) VALUES (
  '2026-01-02',
  'completed',
  6,
  4,
  2,
  0,
  10000,
  'admin',
  NOW(),
  '{"manual_redistribution": true, "tiers": {"gold": 1, "silver": 1, "bronze": 2}, "refunds_paid": 400, "note": "Launch night - 4 winners, no losers"}'
);