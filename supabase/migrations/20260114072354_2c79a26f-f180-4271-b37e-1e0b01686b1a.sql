
-- Update the withdrawal transaction with correct date from OPay screenshot (Jan 13th, 2026 12:18:52)
UPDATE transactions
SET 
  created_at = '2026-01-13 11:18:52+00',
  metadata = jsonb_build_object(
    'full_amount', 4850,
    'transfer_amount', 4800,
    'withdrawal_fee', 50,
    'bank_name', 'OPay',
    'bank_code', '999992',
    'account_number', '9037430356',
    'account_name', 'VICTOR CHIEMERIE',
    'initiated_at', '2026-01-13 11:13:52+00',
    'completed_at', '2026-01-13 11:18:52+00',
    'flutterwave_id', 108542891,
    'flutterwave_transfer_id', 108542891,
    'transaction_no', '260113060100192623871190'
  )
WHERE user_id = 'b23d5dd6-3f5d-49a7-8ad9-62a1feb17dc2'
  AND transaction_type = 'withdrawal'
  AND amount = -4850.00
  AND status = 'completed';
