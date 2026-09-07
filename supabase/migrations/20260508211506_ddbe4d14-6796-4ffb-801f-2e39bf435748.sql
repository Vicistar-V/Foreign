
-- =============================================================
-- Pair tokens table (replaces HMAC tokens from edge functions)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.comparison_pair_tokens (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  image_a_id uuid NOT NULL,
  image_b_id uuid NOT NULL,
  category_slug text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pair_tokens_user_issued
  ON public.comparison_pair_tokens(user_id, issued_at DESC);

ALTER TABLE public.comparison_pair_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages pair tokens" ON public.comparison_pair_tokens;
CREATE POLICY "Service role manages pair tokens"
  ON public.comparison_pair_tokens FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users view own pair tokens" ON public.comparison_pair_tokens;
CREATE POLICY "Users view own pair tokens"
  ON public.comparison_pair_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- =============================================================
-- RPC: task_get_batch(_size)
-- Returns a batch of comparison pairs for the signed-in user.
-- =============================================================
CREATE OR REPLACE FUNCTION public.task_get_batch(_size int DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_batch_size int;
  v_pairs jsonb := '[]'::jsonb;
  v_count int := 0;
  v_cat record;
  v_a_id uuid; v_a_url text;
  v_b_id uuid; v_b_url text;
  v_token uuid;
  v_used_imgs uuid[] := ARRAY[]::uuid[];
  v_used_pairs text[] := ARRAY[]::text[];
  v_pair_key text;
  v_task jsonb;
  v_picked boolean;
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

  -- Clean expired tokens for this user
  DELETE FROM comparison_pair_tokens
   WHERE user_id = v_user AND issued_at < now() - interval '10 minutes';

  WHILE v_count < v_batch_size LOOP
    v_picked := false;

    FOR v_cat IN
      SELECT slug, name FROM comparison_categories
       WHERE is_active = true
       ORDER BY random()
    LOOP
      v_a_id := NULL; v_a_url := NULL;
      v_b_id := NULL; v_b_url := NULL;

      -- Try: 2 images that the user has never seen in this category
      SELECT id, image_url INTO v_a_id, v_a_url
        FROM comparison_images i
       WHERE i.category_slug = v_cat.slug
         AND i.is_dead = false
         AND i.id <> ALL(v_used_imgs)
         AND NOT EXISTS (
           SELECT 1 FROM comparison_votes v
            WHERE v.user_id = v_user AND v.category_slug = v_cat.slug
              AND (v.image_a_id = i.id OR v.image_b_id = i.id)
         )
       ORDER BY random() LIMIT 1;

      IF v_a_id IS NOT NULL THEN
        SELECT id, image_url INTO v_b_id, v_b_url
          FROM comparison_images i
         WHERE i.category_slug = v_cat.slug
           AND i.is_dead = false
           AND i.id <> v_a_id
           AND i.id <> ALL(v_used_imgs)
           AND NOT EXISTS (
             SELECT 1 FROM comparison_votes v
              WHERE v.user_id = v_user AND v.category_slug = v_cat.slug
                AND (v.image_a_id = i.id OR v.image_b_id = i.id)
           )
         ORDER BY random() LIMIT 1;
      END IF;

      -- Fallback: 1 unseen + 1 any other live image in this category
      IF v_a_id IS NOT NULL AND v_b_id IS NULL THEN
        SELECT id, image_url INTO v_b_id, v_b_url
          FROM comparison_images i
         WHERE i.category_slug = v_cat.slug
           AND i.is_dead = false
           AND i.id <> v_a_id
           AND i.id <> ALL(v_used_imgs)
         ORDER BY random() LIMIT 1;
      END IF;

      -- Fallback: any pair in this category not yet used in this batch
      IF v_a_id IS NULL OR v_b_id IS NULL THEN
        SELECT id, image_url INTO v_a_id, v_a_url
          FROM comparison_images
         WHERE category_slug = v_cat.slug AND is_dead = false
           AND id <> ALL(v_used_imgs)
         ORDER BY random() LIMIT 1;
        IF v_a_id IS NOT NULL THEN
          SELECT id, image_url INTO v_b_id, v_b_url
            FROM comparison_images
           WHERE category_slug = v_cat.slug AND is_dead = false
             AND id <> v_a_id AND id <> ALL(v_used_imgs)
           ORDER BY random() LIMIT 1;
        END IF;
      END IF;

      IF v_a_id IS NOT NULL AND v_b_id IS NOT NULL THEN
        v_pair_key := LEAST(v_a_id::text, v_b_id::text) || '|' ||
                      GREATEST(v_a_id::text, v_b_id::text);
        IF NOT (v_pair_key = ANY(v_used_pairs)) THEN
          v_picked := true;
          EXIT;
        END IF;
      END IF;
    END LOOP;

    EXIT WHEN NOT v_picked;

    v_used_imgs := array_append(v_used_imgs, v_a_id);
    v_used_imgs := array_append(v_used_imgs, v_b_id);
    v_used_pairs := array_append(v_used_pairs, v_pair_key);

    INSERT INTO comparison_pair_tokens(user_id, image_a_id, image_b_id, category_slug)
    VALUES (v_user, v_a_id, v_b_id, v_cat.slug)
    RETURNING token INTO v_token;

    v_pairs := v_pairs || jsonb_build_array(jsonb_build_object(
      'pair_token', v_token,
      'category_slug', v_cat.slug,
      'category_name', v_cat.name,
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
END $$;

GRANT EXECUTE ON FUNCTION public.task_get_batch(int) TO authenticated;

-- =============================================================
-- RPC: task_get_pair() — single pair convenience wrapper
-- =============================================================
CREATE OR REPLACE FUNCTION public.task_get_pair()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch jsonb;
  v_first jsonb;
BEGIN
  v_batch := public.task_get_batch(1);
  IF NOT (v_batch->>'success')::boolean THEN
    RETURN v_batch;
  END IF;
  v_first := (v_batch->'pairs')->0;
  RETURN jsonb_build_object(
    'success', true,
    'pair_token', v_first->>'pair_token',
    'category_slug', v_first->>'category_slug',
    'category_name', v_first->>'category_name',
    'image_a', v_first->'image_a',
    'image_b', v_first->'image_b',
    'task', v_batch->'task'
  );
END $$;

GRANT EXECUTE ON FUNCTION public.task_get_pair() TO authenticated;

-- =============================================================
-- RPC: task_submit_vote(pair_token, winner, decision_ms)
-- =============================================================
CREATE OR REPLACE FUNCTION public.task_submit_vote(
  _pair_token uuid,
  _winner text,
  _decision_ms int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_tok comparison_pair_tokens%ROWTYPE;
  v_min_ms int := 800;
  v_vote jsonb;
  v_batch jsonb := NULL;
  v_task jsonb;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'auth');
  END IF;
  IF _winner NOT IN ('a','b') THEN
    RETURN jsonb_build_object('success', false, 'error', 'bad_input');
  END IF;

  IF COALESCE(_decision_ms, 0) < v_min_ms THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'too_fast',
      'message', 'Take a moment to look.'
    );
  END IF;

  SELECT * INTO v_tok
    FROM comparison_pair_tokens
   WHERE token = _pair_token AND user_id = v_user;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_pair');
  END IF;
  IF v_tok.issued_at < now() - interval '10 minutes' THEN
    DELETE FROM comparison_pair_tokens WHERE token = _pair_token;
    RETURN jsonb_build_object('success', false, 'error', 'invalid_pair');
  END IF;

  v_vote := record_comparison_vote(
    v_user,
    v_tok.category_slug,
    v_tok.image_a_id,
    v_tok.image_b_id,
    _winner,
    GREATEST(0, COALESCE(_decision_ms, 0))
  );

  DELETE FROM comparison_pair_tokens WHERE token = _pair_token;

  IF COALESCE((v_vote->>'batch_completed')::boolean, false) THEN
    v_batch := complete_batch(v_user);
  END IF;

  v_task := get_daily_task(v_user);
  RETURN jsonb_build_object(
    'success', true,
    'vote', v_vote,
    'batch', v_batch,
    'task', v_task
  );
END $$;

GRANT EXECUTE ON FUNCTION public.task_submit_vote(uuid, text, int) TO authenticated;

-- =============================================================
-- RPC: task_report_broken_image(image_id)
-- =============================================================
CREATE OR REPLACE FUNCTION public.task_report_broken_image(_image_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'auth');
  END IF;
  IF _image_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'bad_input');
  END IF;
  BEGIN
    INSERT INTO comparison_broken_reports(image_id, reporter_id)
    VALUES (_image_id, v_user);
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
  RETURN jsonb_build_object('success', true);
END $$;

GRANT EXECUTE ON FUNCTION public.task_report_broken_image(uuid) TO authenticated;

-- =============================================================
-- RPC: task_get_daily_task()
-- =============================================================
CREATE OR REPLACE FUNCTION public.task_get_daily_task()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'auth');
  END IF;
  RETURN get_daily_task(v_user);
END $$;

GRANT EXECUTE ON FUNCTION public.task_get_daily_task() TO authenticated;

-- =============================================================
-- RPC: task_complete_batch() — wraps complete_batch with anti-spam floor
-- =============================================================
CREATE OR REPLACE FUNCTION public.task_complete_batch()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'Africa/Lagos')::date;
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
  -- Anti-spam floor: 75% of the loader screen length, minimum 10s
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
END $$;

GRANT EXECUTE ON FUNCTION public.task_complete_batch() TO authenticated;
