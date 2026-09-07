
-- Create a completed withdrawal transaction for Victor Chiemerie for marketing
INSERT INTO transactions (
  user_id,
  amount,
  description,
  transaction_type,
  wallet_type,
  status,
  payment_reference,
  metadata,
  created_at
) VALUES (
  'b23d5dd6-3f5d-49a7-8ad9-62a1feb17dc2',
  -4850.00,
  'Withdrawal to Zenith bank PLC',
  'withdrawal',
  'earnings',
  'completed',
  'WD-' || EXTRACT(EPOCH FROM NOW())::bigint || '000-victorc',
  jsonb_build_object(
    'full_amount', 4850,
    'transfer_amount', 4800,
    'withdrawal_fee', 50,
    'bank_name', 'Zenith bank PLC',
    'bank_code', '057',
    'account_number', '2******51',
    'account_name', 'VICTOR CHIEMERIE',
    'initiated_at', NOW() - interval '5 minutes',
    'completed_at', NOW(),
    'flutterwave_id', 108542891,
    'flutterwave_transfer_id', 108542891
  ),
  NOW()
);

-- Refresh Victor's cache
SELECT refresh_user_cache('b23d5dd6-3f5d-49a7-8ad9-62a1feb17dc2');
