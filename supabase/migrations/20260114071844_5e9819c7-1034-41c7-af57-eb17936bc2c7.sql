
-- Update Victor Chiemerie's withdrawal to OPay
UPDATE transactions
SET 
  description = 'Withdrawal to OPay',
  metadata = jsonb_build_object(
    'full_amount', 4850,
    'transfer_amount', 4800,
    'withdrawal_fee', 50,
    'bank_name', 'OPay',
    'bank_code', '999992',
    'account_number', '9037430356',
    'account_name', 'VICTOR CHIEMERIE',
    'initiated_at', NOW() - interval '5 minutes',
    'completed_at', NOW(),
    'flutterwave_id', 108542891,
    'flutterwave_transfer_id', 108542891
  )
WHERE user_id = 'b23d5dd6-3f5d-49a7-8ad9-62a1feb17dc2'
  AND transaction_type = 'withdrawal'
  AND amount = -4850.00
  AND status = 'completed';
