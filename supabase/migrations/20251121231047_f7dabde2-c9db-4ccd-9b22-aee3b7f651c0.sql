-- Clean up the 3 stuck withdrawal transactions
-- These were already refunded but stuck in 'pending' status

UPDATE transactions 
SET 
  status = 'failed',
  metadata = jsonb_set(
    jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{failure_reason}',
      '"Transfer creation failed - already refunded by system"'::jsonb
    ),
    '{failed_at}',
    to_jsonb(now()::text)
  )
WHERE payment_reference IN (
  'WD-1763763404497-ba3b7ffc',
  'WD-1763763414287-ba3b7ffc',
  'WD-1763763421207-ba3b7ffc'
)
AND status = 'pending';