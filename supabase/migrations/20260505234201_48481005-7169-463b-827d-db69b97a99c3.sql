
-- ============================================
-- 1) Drop fill audit log
-- ============================================
CREATE TABLE IF NOT EXISTS public.drop_fill_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  origin_drop_id uuid,
  event_type text NOT NULL, -- 'distribution_started','fill','payout','reentry_created','distribution_completed','error'
  drop_id uuid,
  spot_id uuid,
  owner_id uuid,
  owner_name text,
  position integer,
  amount numeric,
  payout_made boolean DEFAULT false,
  reentry_created boolean DEFAULT false,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_drop_fill_audit_log_origin ON public.drop_fill_audit_log(origin_drop_id);
CREATE INDEX IF NOT EXISTS idx_drop_fill_audit_log_owner ON public.drop_fill_audit_log(owner_id);
CREATE INDEX IF NOT EXISTS idx_drop_fill_audit_log_created ON public.drop_fill_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drop_fill_audit_log_event ON public.drop_fill_audit_log(event_type);

ALTER TABLE public.drop_fill_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view fill audit log"
  ON public.drop_fill_audit_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages fill audit log"
  ON public.drop_fill_audit_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- 2) Safe position allocator (advisory lock)
-- ============================================
CREATE OR REPLACE FUNCTION public.claim_next_drop_position()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next integer;
BEGIN
  -- Serialize concurrent position allocations across the whole drops queue.
  PERFORM pg_advisory_xact_lock(hashtext('drops_position_allocator'));

  SELECT COALESCE(MAX(position), 0) + 1 INTO v_next FROM public.drops;
  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_drop_position() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_next_drop_position() TO service_role;
