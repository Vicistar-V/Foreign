-- Vivian Ikechi Wike (dae463a3-767c-46fe-bed7-a9d27f9a4548)
-- Goal: remove all withdrawals + make her earnings balance exactly 1002 via ledger, then force cache refresh.

begin;

-- 1) Delete ALL withdrawal requests for Vivian (pending/completed/failed)
delete from public.transactions
where user_id = 'dae463a3-767c-46fe-bed7-a9d27f9a4548'
  and transaction_type = 'withdrawal';

-- 2) Add a single ledger correction so her earnings becomes exactly ₦1,002
-- Current earnings from drop_profit = 400 + 400 + 400 = 1,200
-- Needed: 1,002  => subtract 198
insert into public.transactions (
  user_id,
  wallet_type,
  amount,
  transaction_type,
  description,
  status,
  metadata
)
values (
  'dae463a3-767c-46fe-bed7-a9d27f9a4548',
  'earnings',
  -198,
  'debt_reversal',
  'Balance correction (support fix): set earnings to ₦1,002',
  'completed',
  jsonb_build_object(
    'reason', 'support_balance_reset',
    'target_earnings_balance', 1002,
    'note', 'User requested full reset; removed withdrawals and corrected earnings.'
  )
);

-- 3) Force recompute by clearing cached balance row (it will rebuild on next read)
delete from public.cached_balances
where user_id = 'dae463a3-767c-46fe-bed7-a9d27f9a4548';

commit;