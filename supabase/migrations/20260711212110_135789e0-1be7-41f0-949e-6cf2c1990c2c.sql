-- Retirement Economy V1: drop legacy cycle-royalty SQL and add
-- user-facing message when a member's basket is capped.

-- 1. Drop stale cycle-era helpers (fully replaced by distribute-liquidity
--    and pay_referrer_activation_bonus).
DROP FUNCTION IF EXISTS public.pay_user_profit(uuid, uuid, numeric, boolean);
DROP FUNCTION IF EXISTS public.pay_referral_bonus(text, uuid, numeric);
DROP FUNCTION IF EXISTS public.pay_referral_bonus(uuid, text, numeric);
DROP FUNCTION IF EXISTS public.try_auto_buy_machine(uuid);
DROP FUNCTION IF EXISTS public.pay_genesis_yield();

-- 2. Add user-facing message alongside the capacity_full error flag so the
--    frontend can render a friendly copy without re-hardcoding it.
CREATE OR REPLACE FUNCTION public.get_daily_task(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  v := public.task_get_daily_task();
  IF (v ->> 'capacity_full')::boolean IS TRUE THEN
    v := v || jsonb_build_object(
      'message',
      'Your basket is full. Buy another spot to keep earning.'
    );
  END IF;
  RETURN v;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_task(uuid) TO authenticated, service_role;
