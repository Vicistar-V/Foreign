-- ============================================================
-- Migration A: Daily Task foundation (additive only)
-- ============================================================

-- 1. Add pending_balance to cached_balances
ALTER TABLE public.cached_balances
  ADD COLUMN IF NOT EXISTS pending_balance numeric NOT NULL DEFAULT 0;

-- 2. Add new platform_config knobs
ALTER TABLE public.platform_config
  ADD COLUMN IF NOT EXISTS task_batches_per_day integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS task_taps_per_batch integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS task_naira_per_batch numeric NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS task_referral_bonus_batches integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS task_loader_seconds integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS task_enabled boolean NOT NULL DEFAULT true;

-- 3. Create daily_task table
CREATE TABLE IF NOT EXISTS public.daily_task (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_date date NOT NULL,
  batches_done integer NOT NULL DEFAULT 0,
  bonus_batches integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, task_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_task_user_date ON public.daily_task(user_id, task_date);
CREATE INDEX IF NOT EXISTS idx_daily_task_date ON public.daily_task(task_date);

ALTER TABLE public.daily_task ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own daily task"
  ON public.daily_task FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all daily tasks"
  ON public.daily_task FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages daily task"
  ON public.daily_task FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_daily_task_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_daily_task_updated_at ON public.daily_task;
CREATE TRIGGER trg_daily_task_updated_at
  BEFORE UPDATE ON public.daily_task
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_daily_task_updated_at();

-- 4. Create referral_bonus_grants table (idempotency for bonus batches)
CREATE TABLE IF NOT EXISTS public.referral_bonus_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referee_id uuid NOT NULL,
  grant_date date NOT NULL,
  bonus_batches_granted integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referrer_id, referee_id, grant_date)
);

CREATE INDEX IF NOT EXISTS idx_rbg_referrer_date ON public.referral_bonus_grants(referrer_id, grant_date);

ALTER TABLE public.referral_bonus_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bonus grants as referrer"
  ON public.referral_bonus_grants FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_id);

CREATE POLICY "Admins can view all bonus grants"
  ON public.referral_bonus_grants FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages bonus grants"
  ON public.referral_bonus_grants FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 5. Backfill cached_balances.pending_balance for existing users (zero by default — no-op)
UPDATE public.cached_balances SET pending_balance = 0 WHERE pending_balance IS NULL;