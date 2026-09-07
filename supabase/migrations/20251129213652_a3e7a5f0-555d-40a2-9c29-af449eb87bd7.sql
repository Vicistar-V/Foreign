-- =====================================================
-- TRIGGER UPDATE: Add UPDATE event to balance trigger
-- =====================================================
-- This ensures that if any transaction amount is ever 
-- updated (e.g., status change from pending to completed),
-- the user balance will recalculate accurately.

-- Drop existing trigger
DROP TRIGGER IF EXISTS trigger_update_user_balances ON public.transactions;

-- Recreate trigger to fire on both INSERT and UPDATE
CREATE TRIGGER trigger_update_user_balances
AFTER INSERT OR UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_user_balances();

-- Add comment explaining the trigger
COMMENT ON TRIGGER trigger_update_user_balances ON public.transactions IS 
'Auto-recalculates user_balances cache whenever a transaction is inserted or updated. Ensures balance accuracy during high-volume refund waves and distribution processing.';