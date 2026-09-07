-- ============================================
-- FIX: Recalculate balances from transactions
-- ============================================

-- Drop the old buggy trigger
DROP TRIGGER IF EXISTS trigger_update_user_balances ON public.transactions;

-- Create the CORRECT trigger function that recalculates from source
CREATE OR REPLACE FUNCTION public.update_user_balances()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_earnings_total DECIMAL(12, 2);
  v_deposit_total DECIMAL(12, 2);
  v_credits_total DECIMAL(12, 2);
BEGIN
  -- ============================================
  -- RECALCULATE from ALL transactions (not increment!)
  -- ============================================
  
  -- Calculate ACTUAL earnings balance from transactions
  SELECT COALESCE(SUM(amount), 0) INTO v_earnings_total
  FROM public.transactions
  WHERE user_id = NEW.user_id AND wallet_type = 'earnings';
  
  -- Calculate ACTUAL deposit balance from transactions
  SELECT COALESCE(SUM(amount), 0) INTO v_deposit_total
  FROM public.transactions
  WHERE user_id = NEW.user_id AND wallet_type = 'deposit';
  
  -- Calculate ACTUAL credits balance from transactions
  SELECT COALESCE(SUM(amount), 0) INTO v_credits_total
  FROM public.transactions
  WHERE user_id = NEW.user_id AND wallet_type = 'credits';
  
  -- ============================================
  -- UPDATE cache with COMPUTED values
  -- ============================================
  
  INSERT INTO public.user_balances (
    user_id, 
    earnings_balance, 
    deposit_balance, 
    credits_balance, 
    last_updated
  )
  VALUES (
    NEW.user_id,
    v_earnings_total,
    v_deposit_total,
    v_credits_total,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    earnings_balance = v_earnings_total,
    deposit_balance = v_deposit_total,
    credits_balance = v_credits_total,
    last_updated = now();
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger with the fixed function
CREATE TRIGGER trigger_update_user_balances
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_balances();

-- ============================================
-- SELF-HEALING: Fix all existing corrupted balances
-- ============================================

-- Recalculate all user balances from transactions
INSERT INTO public.user_balances (user_id, earnings_balance, deposit_balance, credits_balance, last_updated)
SELECT 
  t.user_id,
  COALESCE(SUM(CASE WHEN t.wallet_type = 'earnings' THEN t.amount ELSE 0 END), 0) as earnings,
  COALESCE(SUM(CASE WHEN t.wallet_type = 'deposit' THEN t.amount ELSE 0 END), 0) as deposits,
  COALESCE(SUM(CASE WHEN t.wallet_type = 'credits' THEN t.amount ELSE 0 END), 0) as credits,
  now() as last_updated
FROM public.transactions t
GROUP BY t.user_id
ON CONFLICT (user_id) DO UPDATE SET
  earnings_balance = EXCLUDED.earnings_balance,
  deposit_balance = EXCLUDED.deposit_balance,
  credits_balance = EXCLUDED.credits_balance,
  last_updated = now();

-- Add helpful comment
COMMENT ON FUNCTION public.update_user_balances() IS 
  'Recalculates balances from ALL transactions (not incremental). This ensures mathematical correctness and self-correction.';