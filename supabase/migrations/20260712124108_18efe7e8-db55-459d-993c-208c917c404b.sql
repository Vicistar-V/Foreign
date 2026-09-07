
-- Allow 'merged' status for drops that were absorbed into another user ticket.
ALTER TABLE public.drops DROP CONSTRAINT IF EXISTS drops_status_check;
ALTER TABLE public.drops ADD CONSTRAINT drops_status_check
  CHECK (status = ANY (ARRAY['waiting'::text,'filling'::text,'completed'::text,'paid'::text,'re-entered'::text,'pending_redrop'::text,'merged'::text]));

-- 1. Denormalize user_id onto drops.
ALTER TABLE public.drops ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE public.drops d
   SET user_id = s.user_id
  FROM public.spots s
 WHERE s.id = d.spot_id
   AND d.user_id IS NULL;

CREATE INDEX IF NOT EXISTS drops_user_status_idx
  ON public.drops(user_id, status);

-- 2. Extension flag on spots.
ALTER TABLE public.spots ADD COLUMN IF NOT EXISTS is_extension boolean NOT NULL DEFAULT false;

-- 3. Backfill / MERGE.
DO $backfill$
DECLARE
  r RECORD;
  v_survivor_id uuid;
  v_survivor_target numeric;
  v_survivor_fill numeric;
  v_extra_target numeric;
  v_extra_fill numeric;
  v_extra_count int;
BEGIN
  FOR r IN
    SELECT user_id
      FROM public.drops
     WHERE status IN ('waiting','filling') AND user_id IS NOT NULL
     GROUP BY user_id
    HAVING COUNT(*) > 1
  LOOP
    SELECT id, target_amount, fill_amount
      INTO v_survivor_id, v_survivor_target, v_survivor_fill
      FROM public.drops
     WHERE user_id = r.user_id AND status IN ('waiting','filling')
     ORDER BY position ASC, created_at ASC
     LIMIT 1;

    SELECT COALESCE(SUM(target_amount),0), COALESCE(SUM(fill_amount),0), COUNT(*)
      INTO v_extra_target, v_extra_fill, v_extra_count
      FROM public.drops
     WHERE user_id = r.user_id AND status IN ('waiting','filling') AND id <> v_survivor_id;

    UPDATE public.drops
       SET target_amount = v_survivor_target + v_extra_target,
           fill_amount   = v_survivor_fill   + v_extra_fill
     WHERE id = v_survivor_id;

    INSERT INTO public.drop_fill_audit_log (origin_drop_id, event_type, drop_id, owner_id, amount, metadata)
    SELECT
      v_survivor_id,
      'drop_merged_into_survivor',
      d.id,
      d.user_id,
      d.fill_amount,
      jsonb_build_object(
        'survivor_drop_id', v_survivor_id,
        'merged_position', d.position,
        'merged_target', d.target_amount,
        'merged_fill', d.fill_amount
      )
    FROM public.drops d
    WHERE d.user_id = r.user_id
      AND d.status IN ('waiting','filling')
      AND d.id <> v_survivor_id;

    UPDATE public.drops
       SET status = 'merged',
           completed_at = now()
     WHERE user_id = r.user_id
       AND status IN ('waiting','filling')
       AND id <> v_survivor_id;

    UPDATE public.spots
       SET is_extension = true
     WHERE user_id = r.user_id
       AND status = 'active'
       AND id NOT IN (SELECT spot_id FROM public.drops WHERE id = v_survivor_id);

    RAISE NOTICE 'Merged % extra drops into % for user %', v_extra_count, v_survivor_id, r.user_id;
  END LOOP;
END;
$backfill$;

-- 4. One-active-drop-per-user index.
DROP INDEX IF EXISTS public.drops_one_active_per_user;
CREATE UNIQUE INDEX drops_one_active_per_user
  ON public.drops(user_id)
  WHERE status IN ('waiting','filling');

-- 5. get_user_drops_status — every spot echoes the shared ticket.
CREATE OR REPLACE FUNCTION public.get_user_drops_status(_user_id uuid, _limit integer DEFAULT 6, _offset integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result json;
  v_total_spots integer;
  v_total_earnings numeric;
  v_total_cycles integer;
  v_shared_drop json;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(total_earnings), 0), COALESCE(SUM(total_cycles), 0)
  INTO v_total_spots, v_total_earnings, v_total_cycles
  FROM public.spots
  WHERE user_id = _user_id AND status = 'active';

  SELECT json_build_object(
    'drop_id', d.id,
    'id', d.id,
    'position', d.position,
    'fill_amount', COALESCE(d.fill_amount, 0),
    'target_amount', COALESCE(d.target_amount, 0),
    'status', COALESCE(d.status, 'waiting'),
    'source_type', COALESCE(d.source_type, 'new'),
    'fill_percentage', CASE
      WHEN COALESCE(d.target_amount, 0) > 0
      THEN ROUND((COALESCE(d.fill_amount, 0) / d.target_amount) * 100, 1)
      ELSE 0
    END
  )
  INTO v_shared_drop
  FROM public.drops d
  WHERE d.user_id = _user_id
    AND d.status IN ('waiting','filling')
  ORDER BY d.created_at ASC
  LIMIT 1;

  SELECT json_build_object(
    'spots', COALESCE((
      SELECT json_agg(json_build_object(
        'spot_id', s.id,
        'id', s.id,
        'spot_name', COALESCE(s.spot_name, 'Spot'),
        'status', COALESCE(s.status, 'active'),
        'is_extension', COALESCE(s.is_extension, false),
        'total_cycles', COALESCE(s.total_cycles, 0),
        'total_earnings', COALESCE(s.total_earnings, 0),
        'created_at', s.created_at,
        'current_drop', v_shared_drop
      ) ORDER BY s.created_at ASC)
      FROM (
        SELECT *
        FROM public.spots
        WHERE user_id = _user_id AND status = 'active'
        ORDER BY created_at ASC
        LIMIT _limit OFFSET _offset
      ) s
    ), '[]'::json),
    'active_spots_count', v_total_spots,
    'total_earnings_all_time', v_total_earnings,
    'total_spots_count', v_total_spots,
    'total_earnings_all_spots', v_total_earnings,
    'total_cycles_all_spots', v_total_cycles,
    'has_more_spots', (v_total_spots > _limit + _offset),
    'shared_drop', v_shared_drop
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- 6. extend_line_ticket — grow target + record extension + charge wallet.
CREATE OR REPLACE FUNCTION public.extend_line_ticket(
  _user_id uuid,
  _extra_target numeric,
  _new_spot_id uuid,
  _spot_name text,
  _wallet text,
  _fee numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_drop record;
  v_new_target numeric;
BEGIN
  SELECT id, position, target_amount, fill_amount
    INTO v_drop
    FROM public.drops
   WHERE user_id = _user_id AND status IN ('waiting','filling')
   FOR UPDATE
   LIMIT 1;

  IF v_drop.id IS NULL THEN
    RAISE EXCEPTION 'No active ticket to extend' USING ERRCODE = 'P0001';
  END IF;

  v_new_target := v_drop.target_amount + _extra_target;

  UPDATE public.drops
     SET target_amount = v_new_target
   WHERE id = v_drop.id;

  INSERT INTO public.spots (id, user_id, spot_name, status, total_cycles, total_earnings, is_extension)
  VALUES (_new_spot_id, _user_id, _spot_name, 'active', 0, 0, true);

  INSERT INTO public.transactions (user_id, amount, transaction_type, wallet_type, description, status, metadata)
  VALUES (
    _user_id,
    -_fee,
    'drop_entry',
    _wallet::wallet_type,
    _spot_name || ' (extension)',
    'completed',
    jsonb_build_object(
      'spot_id', _new_spot_id,
      'drop_id', v_drop.id,
      'is_extension', true,
      'extra_target', _extra_target,
      'new_target', v_new_target,
      'position', v_drop.position
    )
  );

  RETURN jsonb_build_object(
    'drop_id', v_drop.id,
    'position', v_drop.position,
    'previous_target', v_drop.target_amount,
    'new_target', v_new_target,
    'spot_id', _new_spot_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.extend_line_ticket(uuid, numeric, uuid, text, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.extend_line_ticket(uuid, numeric, uuid, text, text, numeric) TO service_role;

-- 7. retire_all_active_spots — retire the whole capacity on payout.
CREATE OR REPLACE FUNCTION public.retire_all_active_spots(_user_id uuid, _profit numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_retired int;
  v_active_before int;
BEGIN
  SELECT COUNT(*) INTO v_active_before FROM public.spots WHERE user_id=_user_id AND status='active';
  IF v_active_before <= 0 THEN
    RETURN jsonb_build_object('retired', 0);
  END IF;

  UPDATE public.spots
     SET status = 'retired',
         total_cycles = total_cycles + 1,
         total_earnings = total_earnings + ( COALESCE(_profit,0) / v_active_before )
   WHERE user_id = _user_id AND status = 'active';
  GET DIAGNOSTICS v_retired = ROW_COUNT;
  RETURN jsonb_build_object('retired', v_retired);
END;
$$;

REVOKE ALL ON FUNCTION public.retire_all_active_spots(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retire_all_active_spots(uuid, numeric) TO service_role;

-- 8. Auto-fill user_id on new drops (safety net).
CREATE OR REPLACE FUNCTION public.drops_fill_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.spot_id IS NOT NULL THEN
    SELECT user_id INTO NEW.user_id FROM public.spots WHERE id = NEW.spot_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS drops_fill_user_id_trg ON public.drops;
CREATE TRIGGER drops_fill_user_id_trg
BEFORE INSERT ON public.drops
FOR EACH ROW EXECUTE FUNCTION public.drops_fill_user_id();
