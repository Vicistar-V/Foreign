-- 1) Trigger function: on membership activation, grant calibration batches to referrer
CREATE OR REPLACE FUNCTION public.grant_referrer_calibration_on_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id uuid;
BEGIN
  -- Only act when is_member transitions from false to true
  IF (COALESCE(OLD.is_member, false) = false) AND (NEW.is_member = true) THEN
    IF NEW.referred_by_code IS NOT NULL
       AND NEW.referred_by_code <> ''
       AND NEW.referred_by_code <> 'SYSTEM' THEN

      SELECT id INTO v_referrer_id
      FROM public.profiles
      WHERE referral_code = NEW.referred_by_code
      LIMIT 1;

      IF v_referrer_id IS NOT NULL THEN
        BEGIN
          PERFORM public.add_calibration_batches_for_referral(v_referrer_id, NULL);
        EXCEPTION WHEN OTHERS THEN
          -- Never block activation if calibration grant fails
          RAISE WARNING 'grant_referrer_calibration_on_activation failed for referrer %: %', v_referrer_id, SQLERRM;
        END;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_referrer_calibration_on_activation ON public.profiles;
CREATE TRIGGER trg_grant_referrer_calibration_on_activation
AFTER UPDATE OF is_member ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.grant_referrer_calibration_on_activation();

-- 2) Admin RPC: manually grant calibration batches to a user
CREATE OR REPLACE FUNCTION public.admin_grant_calibration_batches(
  _user_id uuid,
  _batches integer,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_caller IS NULL OR NOT public.has_role(v_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  IF _batches IS NULL OR _batches <= 0 THEN
    RAISE EXCEPTION 'Invalid batch count';
  END IF;

  v_result := public.add_calibration_batches_for_referral(_user_id, _batches);

  -- Audit notification for the user
  PERFORM public.create_notification(
    _user_id := _user_id,
    _type := 'calibration_bonus',
    _title := format('+%s bonus batches', _batches),
    _message := COALESCE(_reason, 'An admin granted you bonus calibration batches.'),
    _metadata := jsonb_build_object('admin_id', v_caller, 'batches', _batches, 'reason', _reason)
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_calibration_batches(uuid, integer, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_grant_calibration_batches(uuid, integer, text) TO authenticated;