
-- Fix overpayment: Remove the ₦900 incorrectly added to Abubakar Ishaq
DO $$
DECLARE
  _user_id UUID := '76c346ab-5ae4-4835-8202-180ebd9df801';
BEGIN
  -- Deduct ₦900 from earnings (negative transaction to reverse the overpayment)
  INSERT INTO transactions (user_id, amount, wallet_type, transaction_type, description, status)
  VALUES (_user_id, -900, 'earnings', 'debt_reversal', 'Correction: Remove accidental overpayment', 'completed');

  -- Refresh cache
  PERFORM refresh_user_cache(_user_id);
END $$;
