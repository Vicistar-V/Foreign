
-- Switch task RPCs to UTC and remove category-scoping from pair selection.

CREATE OR REPLACE FUNCTION public.task_complete_batch()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_last timestamptz;
  v_loader_seconds int;
  v_min_interval interval;
  v_result jsonb;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'auth');
  END IF;

  SELECT COALESCE(task_loader_seconds, 30) INTO v_loader_seconds
    FROM platform_config WHERE id = 1;
  v_min_interval := make_interval(secs => GREATEST(10, (v_loader_seconds * 0.75)::int));

  SELECT (metadata->>'last_batch_completed_at')::timestamptz INTO v_last
    FROM daily_task
   WHERE user_id = v_user AND task_date = v_today;

  IF v_last IS NOT NULL AND v_last > now() - v_min_interval THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'too_fast',
      'message', 'Please wait a moment before finishing the next batch.'
    );
  END IF;

  v_result := complete_batch(v_user);

  IF COALESCE((v_result->>'success')::boolean, false) THEN
    UPDATE daily_task
       SET metadata = COALESCE(metadata, '{}'::jsonb)
                      || jsonb_build_object('last_batch_completed_at', now())
     WHERE user_id = v_user AND task_date = v_today;
  END IF;

  RETURN v_result;
END $function$;


CREATE OR REPLACE FUNCTION public.task_submit_batch(_votes jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_batch_result jsonb;
  v_new_batch_number int;
  v_vote jsonb;
  v_idx int := 0;
  v_tok comparison_pair_tokens%ROWTYPE;
  v_pair_token uuid;
  v_winner_pick text;
  v_decision_ms int;
  v_winner_id uuid;
  v_elo_a numeric; v_elo_b numeric;
  v_expected_a numeric; v_expected_b numeric;
  v_score_a numeric; v_score_b numeric;
  v_k constant numeric := 24;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'auth');
  END IF;
  IF _votes IS NULL OR jsonb_typeof(_votes) <> 'array' OR jsonb_array_length(_votes) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_votes');
  END IF;

  v_batch_result := public.task_complete_batch();
  IF NOT COALESCE((v_batch_result->>'success')::boolean, false) THEN
    RETURN v_batch_result;
  END IF;

  v_new_batch_number := COALESCE((v_batch_result->>'batches_done')::int, 0);

  FOR v_vote IN SELECT * FROM jsonb_array_elements(_votes)
  LOOP
    v_idx := v_idx + 1;
    v_pair_token := NULLIF(v_vote->>'pair_token','')::uuid;
    v_winner_pick := v_vote->>'winner';
    v_decision_ms := GREATEST(0, COALESCE((v_vote->>'decision_ms')::int, 0));

    IF v_pair_token IS NULL OR v_winner_pick NOT IN ('a','b') THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_tok
      FROM comparison_pair_tokens
     WHERE token = v_pair_token AND user_id = v_user;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_winner_id := CASE WHEN v_winner_pick = 'a' THEN v_tok.image_a_id ELSE v_tok.image_b_id END;

    INSERT INTO comparison_votes
      (user_id, category_slug, image_a_id, image_b_id, winner_id, decision_ms,
       task_date, batch_number, vote_in_batch)
    VALUES
      (v_user, v_tok.category_slug, v_tok.image_a_id, v_tok.image_b_id, v_winner_id, v_decision_ms,
       v_today, v_new_batch_number, v_idx);

    SELECT elo_score INTO v_elo_a FROM comparison_images WHERE id = v_tok.image_a_id FOR UPDATE;
    SELECT elo_score INTO v_elo_b FROM comparison_images WHERE id = v_tok.image_b_id FOR UPDATE;
    IF v_elo_a IS NULL OR v_elo_b IS NULL THEN
      DELETE FROM comparison_pair_tokens WHERE token = v_pair_token;
      CONTINUE;
    END IF;

    v_expected_a := 1.0 / (1.0 + power(10, (v_elo_b - v_elo_a) / 400.0));
    v_expected_b := 1.0 - v_expected_a;
    v_score_a := CASE WHEN v_winner_pick = 'a' THEN 1 ELSE 0 END;
    v_score_b := 1 - v_score_a;

    UPDATE comparison_images
       SET elo_score = v_elo_a + v_k * (v_score_a - v_expected_a),
           votes_count = votes_count + 1,
           wins_count = wins_count + (CASE WHEN v_winner_pick = 'a' THEN 1 ELSE 0 END)
     WHERE id = v_tok.image_a_id;

    UPDATE comparison_images
       SET elo_score = v_elo_b + v_k * (v_score_b - v_expected_b),
           votes_count = votes_count + 1,
           wins_count = wins_count + (CASE WHEN v_winner_pick = 'b' THEN 1 ELSE 0 END)
     WHERE id = v_tok.image_b_id;

    DELETE FROM comparison_pair_tokens WHERE token = v_pair_token;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'batch', v_batch_result,
    'task', public.get_daily_task(v_user)
  );
END
$function$;


-- Pair selection: ignore categories. Pick random unseen images globally.
CREATE OR REPLACE FUNCTION public.task_get_batch(_size integer DEFAULT NULL::integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_batch_size int;
  v_pairs jsonb := '[]'::jsonb;
  v_count int := 0;
  v_a_id uuid; v_a_url text; v_a_cat text; v_a_cat_name text;
  v_b_id uuid; v_b_url text;
  v_token uuid;
  v_used_imgs uuid[] := ARRAY[]::uuid[];
  v_used_pairs text[] := ARRAY[]::text[];
  v_pair_key text;
  v_task jsonb;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'auth');
  END IF;

  SELECT COALESCE(_size, task_taps_per_batch, 10)
    INTO v_batch_size
    FROM platform_config WHERE id = 1;
  IF v_batch_size IS NULL OR v_batch_size < 1 THEN
    v_batch_size := COALESCE(_size, 10);
  END IF;

  DELETE FROM comparison_pair_tokens
   WHERE user_id = v_user AND issued_at < now() - interval '10 minutes';

  WHILE v_count < v_batch_size LOOP
    v_a_id := NULL; v_a_url := NULL; v_a_cat := NULL;
    v_b_id := NULL; v_b_url := NULL;

    -- Try unseen image A (any category)
    SELECT id, image_url, category_slug INTO v_a_id, v_a_url, v_a_cat
      FROM comparison_images i
     WHERE i.is_dead = false
       AND i.id <> ALL(v_used_imgs)
       AND NOT EXISTS (
         SELECT 1 FROM comparison_votes v
          WHERE v.user_id = v_user
            AND (v.image_a_id = i.id OR v.image_b_id = i.id)
       )
     ORDER BY random() LIMIT 1;

    -- Fallback: any live image not yet used in this batch
    IF v_a_id IS NULL THEN
      SELECT id, image_url, category_slug INTO v_a_id, v_a_url, v_a_cat
        FROM comparison_images
       WHERE is_dead = false
         AND id <> ALL(v_used_imgs)
       ORDER BY random() LIMIT 1;
    END IF;

    EXIT WHEN v_a_id IS NULL;

    -- Pick image B: prefer unseen, any category
    SELECT id, image_url INTO v_b_id, v_b_url
      FROM comparison_images i
     WHERE i.is_dead = false
       AND i.id <> v_a_id
       AND i.id <> ALL(v_used_imgs)
       AND NOT EXISTS (
         SELECT 1 FROM comparison_votes v
          WHERE v.user_id = v_user
            AND (v.image_a_id = i.id OR v.image_b_id = i.id)
       )
     ORDER BY random() LIMIT 1;

    IF v_b_id IS NULL THEN
      SELECT id, image_url INTO v_b_id, v_b_url
        FROM comparison_images
       WHERE is_dead = false
         AND id <> v_a_id
         AND id <> ALL(v_used_imgs)
       ORDER BY random() LIMIT 1;
    END IF;

    EXIT WHEN v_b_id IS NULL;

    v_pair_key := LEAST(v_a_id::text, v_b_id::text) || '|' ||
                  GREATEST(v_a_id::text, v_b_id::text);
    IF v_pair_key = ANY(v_used_pairs) THEN
      v_used_imgs := array_append(v_used_imgs, v_a_id);
      CONTINUE;
    END IF;

    v_used_imgs := array_append(v_used_imgs, v_a_id);
    v_used_imgs := array_append(v_used_imgs, v_b_id);
    v_used_pairs := array_append(v_used_pairs, v_pair_key);

    SELECT name INTO v_a_cat_name FROM comparison_categories WHERE slug = v_a_cat;

    INSERT INTO comparison_pair_tokens(user_id, image_a_id, image_b_id, category_slug)
    VALUES (v_user, v_a_id, v_b_id, COALESCE(v_a_cat, 'mixed'))
    RETURNING token INTO v_token;

    v_pairs := v_pairs || jsonb_build_array(jsonb_build_object(
      'pair_token', v_token,
      'category_slug', COALESCE(v_a_cat, 'mixed'),
      'category_name', COALESCE(v_a_cat_name, 'Pick one'),
      'image_a', jsonb_build_object('id', v_a_id, 'url', v_a_url),
      'image_b', jsonb_build_object('id', v_b_id, 'url', v_b_url)
    ));
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_enough_images');
  END IF;

  v_task := get_daily_task(v_user);
  RETURN jsonb_build_object('success', true, 'pairs', v_pairs, 'task', v_task);
END $function$;
