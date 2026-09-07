-- Step 1: Add 'internal_transfer' to transaction_type enum
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'internal_transfer';

-- Step 2: Create atomic internal transfer function
CREATE OR REPLACE FUNCTION public.process_internal_transfer(
  _user_id UUID,
  _amount DECIMAL,
  _source_wallet wallet_type,
  _destination_wallet wallet_type,
  _transfer_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Both operations happen in a single transaction
  -- If either fails, both are rolled back automatically
  
  -- Debit source wallet
  INSERT INTO public.transactions (
    user_id,
    wallet_type,
    amount,
    transaction_type,
    description,
    payment_reference,
    status,
    metadata
  ) VALUES (
    _user_id,
    _source_wallet,
    -_amount,
    'internal_transfer',
    'Transfer to ' || _destination_wallet || ' wallet',
    NULL,
    'completed',
    jsonb_build_object(
      'transfer_id', _transfer_id,
      'transfer_type', 'internal',
      'direction', 'debit',
      'linked_wallet', _destination_wallet
    )
  );
  
  -- Credit destination wallet
  INSERT INTO public.transactions (
    user_id,
    wallet_type,
    amount,
    transaction_type,
    description,
    payment_reference,
    status,
    metadata
  ) VALUES (
    _user_id,
    _destination_wallet,
    _amount,
    'internal_transfer',
    'Transfer from ' || _source_wallet || ' wallet',
    NULL,
    'completed',
    jsonb_build_object(
      'transfer_id', _transfer_id,
      'transfer_type', 'internal',
      'direction', 'credit',
      'linked_wallet', _source_wallet
    )
  );
  
  -- If we reach here, both operations succeeded atomically
END;
$$;

-- Step 3: Restore the lost ₦5,125 from failed transfers
-- User: ba3b7ffc-2447-4924-803a-6f2869156632
INSERT INTO public.transactions (
  user_id,
  wallet_type,
  amount,
  transaction_type,
  description,
  payment_reference,
  status
) VALUES 
  (
    'ba3b7ffc-2447-4924-803a-6f2869156632',
    'earnings',
    2050,
    'debt_reversal',
    'Restoration of failed transfer from 2025-01-21 (Transaction 1)',
    NULL,
    'completed'
  ),
  (
    'ba3b7ffc-2447-4924-803a-6f2869156632',
    'earnings',
    3075,
    'debt_reversal',
    'Restoration of failed transfer from 2025-01-21 (Transaction 2)',
    NULL,
    'completed'
  );