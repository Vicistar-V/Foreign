-- Delete today's V1 entries (already refunded for V2 upgrade)
DELETE FROM drop_entries 
WHERE drop_date = CURRENT_DATE
  AND metadata->>'v2_upgrade_refund' = 'true';