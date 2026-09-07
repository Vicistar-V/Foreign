-- 3. Find and fix any FAILED withdrawals missing cancel rows
INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
SELECT 
  t.user_id,
  t.wallet_type,
  ABS(t.amount),
  'withdrawal'::transaction_type,
  'Auto-cancel: Failed withdrawal returned',
  'completed',
  jsonb_build_object(
    'original_withdrawal_id', t.id,
    'original_reference', t.payment_reference,
    'cancel_reason', 'Failed withdrawal auto-correction',
    'corrected_at', now()
  )
FROM transactions t
WHERE t.transaction_type = 'withdrawal'
  AND t.status = 'failed'
  AND t.amount < 0
  AND NOT EXISTS (
    SELECT 1 FROM transactions t2
    WHERE t2.user_id = t.user_id
      AND t2.wallet_type = t.wallet_type
      AND t2.amount = ABS(t.amount)
      AND t2.created_at > t.created_at
      AND (
        t2.description ILIKE '%refund%' 
        OR t2.description ILIKE '%cancel%'
        OR t2.description ILIKE '%return%'
        OR t2.metadata->>'original_withdrawal_id' = t.id::text
      )
  );

-- 4. Clear ALL cached balances to force recalculation
DELETE FROM cached_balances;