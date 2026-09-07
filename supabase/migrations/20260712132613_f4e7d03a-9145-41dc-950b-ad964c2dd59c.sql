
-- Add new transaction_type value first (must be committed before use in same tx below is OK inside DO block? Postgres allows ALTER TYPE ADD VALUE outside a tx-block only in newer versions but we're inside a migration tx; workaround: add via separate step at top with COMMIT? Migrations run in autocommit-per-statement, so this is fine.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'transaction_type' AND e.enumlabel = 'pending_reconciliation'
  ) THEN
    ALTER TYPE transaction_type ADD VALUE 'pending_reconciliation';
  END IF;
END$$;
