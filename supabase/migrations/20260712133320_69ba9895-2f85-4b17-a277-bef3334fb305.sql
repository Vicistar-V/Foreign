
-- =========================================================================
-- Retirement-Economy audit round 4: F4, F10, F11, F13
-- =========================================================================

-- F11 (P2): keep drop_target_amount = drop_profit_amount = drop_profit_amount_subsequent
-- as a single source of truth at the DB level. Any drift silently breaks the
-- admin dashboard's margin display and any legacy caller.
CREATE OR REPLACE FUNCTION public.sync_drop_target_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Prefer drop_target_amount as canonical. If only the legacy columns changed,
  -- surface that into the canonical column too.
  IF NEW.drop_target_amount IS NOT NULL AND NEW.drop_target_amount > 0 THEN
    NEW.drop_profit_amount := NEW.drop_target_amount;
    NEW.drop_profit_amount_subsequent := NEW.drop_target_amount;
  ELSIF NEW.drop_profit_amount IS NOT NULL AND NEW.drop_profit_amount > 0 THEN
    NEW.drop_target_amount := NEW.drop_profit_amount;
    NEW.drop_profit_amount_subsequent := NEW.drop_profit_amount;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_drop_target_columns ON public.platform_config;
CREATE TRIGGER trg_sync_drop_target_columns
  BEFORE INSERT OR UPDATE ON public.platform_config
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_drop_target_columns();

-- One-off backfill so any historical drift is corrected right now.
UPDATE public.platform_config
   SET drop_target_amount = COALESCE(NULLIF(drop_target_amount, 0), drop_profit_amount)
 WHERE id = 1;


-- F4 (P1): accept an optional idempotency key on batch completion so a retried
-- POST after network timeout does not credit a second ₦50.
--
-- Backwards-compat: keep the old 1-arg signature working (callers that don't
-- pass a key). New 2-arg signature dedupes via a partial unique index on
-- transactions.metadata->>'idempotency_key'.

CREATE UNIQUE INDEX IF NOT EXISTS uq_task_earning_idem
  ON public.transactions ((metadata->>'idempotency_key'))
  WHERE transaction_type = 'task_earning'
    AND metadata ? 'idempotency_key';

CREATE OR REPLACE FUNCTION public.complete_batch(_user_id uuid, _idempotency_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cfg RECORD;
  today_utc date;
  spot_count int;
  naira_per_batch_for_user numeric;
  task_row RECORD;
  total_today int;
  new_batches_done int;
  base_batches_per_day int;
  unlimited boolean;
  referrer_uuid uuid;
  referrer_code text;
  new_pending numeric;
  pending numeric;
  cap numeric;
  cap_per_spot numeric;
  just_completed_full_set boolean := false;
  has_prior_full_set boolean := false;
  v_key text;
  v_prior_tx RECORD;
BEGIN
  IF _user_id IS NULL THEN RETURN jsonb_build_object('success',false,'error','missing user'); END IF;

  PERFORM pg_advisory_xact_lock(hashtext('complete_batch:' || _user_id::text));

  v_key := NULLIF(TRIM(COALESCE(_idempotency_key, '')), '');

  -- F4: replay guard. If we've already credited a task_earning for this key,
  -- return the same shape a success response has, computed from live state.
  IF v_key IS NOT NULL THEN
    SELECT id, amount, metadata INTO v_prior_tx
      FROM public.transactions
     WHERE user_id = _user_id
       AND transaction_type = 'task_earning'
       AND metadata->>'idempotency_key' = v_key
     LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'replay', true,
        'naira_added', v_prior_tx.amount,
        'pending_balance', public.get_pending_balance(_user_id)
      );
    END IF;
  END IF;

  SELECT task_batches_per_day, task_taps_per_batch, task_naira_per_batch,
         task_enabled, drop_target_amount, drop_profit_amount, drop_entry_fee
    INTO cfg FROM public.platform_config WHERE id = 1;

  IF NOT cfg.task_enabled THEN
    RETURN jsonb_build_object('success',false,'error','task_disabled');
  END IF;

  -- F12 belt-and-braces: never credit ₦0 task earnings.
  IF COALESCE(cfg.task_naira_per_batch, 0) <= 0 THEN
    RETURN jsonb_build_object('success',false,'error','task_rate_zero');
  END IF;

  today_utc := (now() AT TIME ZONE 'UTC')::date;

  SELECT COUNT(*) INTO spot_count FROM public.spots
    WHERE user_id = _user_id AND status = 'active';
  IF spot_count < 1 THEN
    RETURN jsonb_build_object('success',false,'error','no_active_spot');
  END IF;

  naira_per_batch_for_user := cfg.task_naira_per_batch;
  base_batches_per_day := cfg.task_batches_per_day;
  unlimited := (base_batches_per_day = 0);

  cap_per_spot := COALESCE(NULLIF(cfg.drop_target_amount, 0), cfg.drop_profit_amount);
  pending := public.get_pending_balance(_user_id);
  cap := cap_per_spot * spot_count;

  IF cap > 0 AND pending + naira_per_batch_for_user > cap THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'capacity_full',
      'pending', pending,
      'cap', cap,
      'extension_spot_price', cfg.drop_entry_fee,
      'payout_per_spot', cap_per_spot
    );
  END IF;

  INSERT INTO public.daily_task (user_id, task_date, batches_done, bonus_batches)
    VALUES (_user_id, today_utc, 0, 0)
    ON CONFLICT (user_id, task_date) DO NOTHING;
  SELECT * INTO task_row FROM public.daily_task
    WHERE user_id=_user_id AND task_date=today_utc FOR UPDATE;

  IF NOT unlimited THEN
    total_today := base_batches_per_day + task_row.bonus_batches;
    IF task_row.batches_done >= total_today THEN
      RETURN jsonb_build_object(
        'success',false,'error','limit_reached',
        'batches_done',task_row.batches_done,'total_batches_today',total_today
      );
    END IF;
  ELSE
    total_today := 0;
  END IF;

  new_batches_done := task_row.batches_done + 1;
  UPDATE public.daily_task SET batches_done = new_batches_done
    WHERE user_id=_user_id AND task_date=today_utc;

  INSERT INTO public.transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES (_user_id,'pending'::wallet_type, naira_per_batch_for_user,
          'task_earning'::transaction_type,
          'Daily task earnings','completed'::transaction_status,
          jsonb_build_object(
            'task_date', today_utc,
            'batch_number', new_batches_done,
            'spot_count', spot_count,
            'naira_per_batch', naira_per_batch_for_user,
            'unlimited', unlimited,
            'idempotency_key', v_key
          ));
  new_pending := public.get_pending_balance(_user_id);

  IF NOT unlimited AND new_batches_done >= base_batches_per_day THEN
    SELECT EXISTS (
      SELECT 1 FROM public.daily_task
      WHERE user_id = _user_id AND task_date < today_utc
        AND batches_done >= base_batches_per_day
    ) INTO has_prior_full_set;

    just_completed_full_set := NOT has_prior_full_set
      AND task_row.batches_done < base_batches_per_day
      AND new_batches_done >= base_batches_per_day;

    IF just_completed_full_set THEN
      SELECT referred_by_code INTO referrer_code FROM public.profiles WHERE id=_user_id;
      -- F7: trim whitespace-only codes.
      referrer_code := NULLIF(TRIM(COALESCE(referrer_code, '')), '');
      IF referrer_code IS NOT NULL AND UPPER(referrer_code) <> 'SYSTEM' THEN
        SELECT id INTO referrer_uuid FROM public.profiles WHERE referral_code=referrer_code LIMIT 1;
        IF referrer_uuid IS NOT NULL AND referrer_uuid <> _user_id THEN
          PERFORM public.grant_referral_bonus_batches(referrer_uuid, _user_id);
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success',true,
    'batches_done',new_batches_done,
    'bonus_batches',task_row.bonus_batches,
    'total_batches_today',total_today,
    'unlimited', unlimited,
    'naira_added',naira_per_batch_for_user,
    'pending_balance',new_pending,
    'pending_cap', cap,
    'completed_full_set_today', just_completed_full_set
  );
END;
$function$;

-- Keep the legacy 1-arg signature working; just forward with NULL key.
CREATE OR REPLACE FUNCTION public.complete_batch(_user_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.complete_batch(_user_id, NULL::text);
$$;

REVOKE ALL ON FUNCTION public.complete_batch(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_batch(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_batch(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_batch(uuid, text) TO service_role;


-- F4 wrapper: accept idempotency key from clients.
CREATE OR REPLACE FUNCTION public.task_submit_batch(_choices jsonb DEFAULT NULL::jsonb, _idempotency_key text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_batch_result jsonb;
  v_choice jsonb;
  v_a uuid; v_b uuid; v_chosen uuid; v_cat text;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'auth');
  END IF;

  IF _choices IS NOT NULL AND jsonb_typeof(_choices) = 'array' THEN
    FOR v_choice IN SELECT * FROM jsonb_array_elements(_choices)
    LOOP
      BEGIN
        v_a := (v_choice->>'image_a_id')::uuid;
        v_b := (v_choice->>'image_b_id')::uuid;
        v_chosen := (v_choice->>'chosen_image_id')::uuid;
        v_cat := v_choice->>'category_slug';

        IF v_a IS NOT NULL AND v_b IS NOT NULL AND v_chosen IS NOT NULL
           AND v_cat IS NOT NULL AND v_chosen IN (v_a, v_b) THEN
          INSERT INTO comparison_choices(user_id, category_slug, image_a_id, image_b_id, chosen_image_id)
          VALUES (v_user, v_cat, v_a, v_b, v_chosen);
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END LOOP;
  END IF;

  v_batch_result := public.complete_batch(v_user, _idempotency_key);
  IF NOT COALESCE((v_batch_result->>'success')::boolean, false) THEN
    RETURN v_batch_result;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'batch', v_batch_result,
    'task', public.get_daily_task(v_user)
  );
END $function$;


-- F13 (P2): enrich referral pending-bump metadata so audits can reconstruct why
-- an actual_amount was capped without replaying state.
CREATE OR REPLACE FUNCTION public.pay_referrer_activation_bonus(_referee_id uuid, _referred_by_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code TEXT;
  v_referrer_id UUID;
  v_referrer_code_of_referrer TEXT;
  v_referee_code TEXT;
  v_referrer_is_banned BOOLEAN;
  v_cash_amount NUMERIC;
  v_pending_bump_configured NUMERIC;
  v_pending_bump_actual NUMERIC;
  v_referee_name TEXT;
  v_already_paid BOOLEAN;
  v_already_bumped BOOLEAN;
  v_referrer_spots INT;
  v_referrer_cap NUMERIC;
  v_referrer_pending NUMERIC;
  v_room NUMERIC;
  v_cap_per_spot NUMERIC;
BEGIN
  v_code := TRIM(COALESCE(_referred_by_code, ''));
  IF v_code = '' OR UPPER(v_code) = 'SYSTEM' THEN RETURN; END IF;

  SELECT id, COALESCE(is_banned, false), referred_by_code
    INTO v_referrer_id, v_referrer_is_banned, v_referrer_code_of_referrer
    FROM profiles WHERE referral_code = v_code;
  IF v_referrer_id IS NULL OR v_referrer_id = _referee_id THEN RETURN; END IF;
  IF v_referrer_is_banned THEN RETURN; END IF;

  SELECT referral_code INTO v_referee_code FROM profiles WHERE id = _referee_id;
  IF v_referee_code IS NOT NULL AND v_referrer_code_of_referrer IS NOT NULL
     AND TRIM(v_referrer_code_of_referrer) = v_referee_code THEN
    RETURN;
  END IF;

  SELECT referral_cash_bonus, referral_pending_bonus,
         COALESCE(NULLIF(drop_target_amount, 0), drop_profit_amount)
    INTO v_cash_amount, v_pending_bump_configured, v_cap_per_spot
    FROM platform_config WHERE id = 1;

  SELECT full_name INTO v_referee_name FROM profiles WHERE id = _referee_id;

  IF v_cash_amount IS NOT NULL AND v_cash_amount > 0 THEN
    SELECT EXISTS(
      SELECT 1 FROM transactions
      WHERE user_id = v_referrer_id
        AND transaction_type = 'referral_payout'
        AND wallet_type = 'earnings'
        AND metadata->>'referee_id' = _referee_id::text
        AND metadata->>'paid_on' = 'activation'
    ) INTO v_already_paid;

    IF NOT v_already_paid THEN
      INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
      VALUES (
        v_referrer_id, 'earnings', v_cash_amount, 'referral_payout',
        format('Referral bonus - %s activated', COALESCE(v_referee_name, 'your friend')),
        'completed',
        jsonb_build_object('referee_id', _referee_id, 'referee_name', v_referee_name, 'paid_on', 'activation')
      );
    END IF;
  END IF;

  IF v_pending_bump_configured IS NOT NULL AND v_pending_bump_configured > 0 THEN
    SELECT EXISTS(
      SELECT 1 FROM transactions
      WHERE user_id = v_referrer_id
        AND transaction_type = 'task_earning'
        AND wallet_type = 'pending'
        AND metadata->>'source' = 'referral_pending_bump'
        AND metadata->>'referee_id' = _referee_id::text
    ) INTO v_already_bumped;

    IF NOT v_already_bumped THEN
      PERFORM pg_advisory_xact_lock(hashtext('complete_batch:' || v_referrer_id::text));

      SELECT COUNT(*) INTO v_referrer_spots FROM spots
        WHERE user_id = v_referrer_id AND status = 'active';

      IF v_referrer_spots > 0 THEN
        v_referrer_cap := v_cap_per_spot * v_referrer_spots;
        v_referrer_pending := public.get_pending_balance(v_referrer_id);
        v_room := GREATEST(v_referrer_cap - v_referrer_pending, 0);
        v_pending_bump_actual := LEAST(v_pending_bump_configured, v_room);

        IF v_pending_bump_actual > 0 THEN
          INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
          VALUES (
            v_referrer_id, 'pending', v_pending_bump_actual, 'task_earning',
            format('Referral shortcut - %s activated', COALESCE(v_referee_name, 'your friend')),
            'completed',
            jsonb_build_object(
              'source', 'referral_pending_bump',
              'referee_id', _referee_id,
              'referee_name', v_referee_name,
              'configured_amount', v_pending_bump_configured,
              'actual_amount', v_pending_bump_actual,
              'reason', CASE WHEN v_pending_bump_actual < v_pending_bump_configured THEN 'capped_at_room' ELSE 'full' END,
              -- F13: audit-friendly snapshot of the sponsor's basket state at bump time.
              'referrer_spot_count', v_referrer_spots,
              'referrer_cap_per_spot', v_cap_per_spot,
              'referrer_cap', v_referrer_cap,
              'referrer_pending_before', v_referrer_pending,
              'referrer_room_before', v_room
            )
          );
        END IF;
      END IF;
    END IF;
  END IF;

  IF NOT COALESCE(v_already_paid, true) OR NOT COALESCE(v_already_bumped, true) THEN
    PERFORM create_notification(
      _user_id := v_referrer_id,
      _type := 'referral_bonus_paid',
      _title := format('%s just activated!', COALESCE(v_referee_name, 'Your friend')),
      _message := CASE
        WHEN COALESCE(v_pending_bump_actual, 0) > 0 THEN
          format('₦%s cash added to your earnings + ₦%s jumped into your pending balance. Your line just got shorter.',
            v_cash_amount, v_pending_bump_actual)
        ELSE
          format('₦%s added to your earnings balance.', v_cash_amount)
        END,
      _metadata := jsonb_build_object(
        'referee_id', _referee_id,
        'cash_amount', v_cash_amount,
        'pending_bump', COALESCE(v_pending_bump_actual, 0)
      )::jsonb,
      _link := '/wallet'
    );
  END IF;
END;
$function$;
