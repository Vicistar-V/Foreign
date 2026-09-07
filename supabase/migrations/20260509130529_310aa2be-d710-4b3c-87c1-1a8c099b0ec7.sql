-- 1. Per-user seen log
CREATE TABLE IF NOT EXISTS public.comparison_seen_log (
  user_id uuid NOT NULL,
  image_id uuid NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, image_id)
);

CREATE INDEX IF NOT EXISTS idx_comparison_seen_log_user ON public.comparison_seen_log(user_id);

ALTER TABLE public.comparison_seen_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own seen log" ON public.comparison_seen_log;
CREATE POLICY "Users view own seen log" ON public.comparison_seen_log
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages seen log" ON public.comparison_seen_log;
CREATE POLICY "Service role manages seen log" ON public.comparison_seen_log
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 2. Upgrade task_get_batch with tiered freshness
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
  v_used uuid[] := ARRAY[]::uuid[];
  v_task jsonb;
  v_safety int := 0;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'auth');
  END IF;

  SELECT COALESCE(_size, task_taps_per_batch, 10)
    INTO v_batch_size FROM platform_config WHERE id = 1;
  IF v_batch_size IS NULL OR v_batch_size < 1 THEN
    v_batch_size := COALESCE(_size, 10);
  END IF;

  WHILE v_count < v_batch_size AND v_safety < 300 LOOP
    v_safety := v_safety + 1;
    v_a_id := NULL; v_b_id := NULL; v_a_cat := NULL;

    -- TIER 1: category with ≥2 UNSEEN live images
    SELECT ci.category_slug INTO v_a_cat
      FROM comparison_images ci
     WHERE ci.is_dead = false
       AND ci.id <> ALL(v_used)
       AND NOT EXISTS (
         SELECT 1 FROM comparison_seen_log s
          WHERE s.user_id = v_user AND s.image_id = ci.id
       )
     GROUP BY ci.category_slug
     HAVING COUNT(*) >= 2
     ORDER BY random() LIMIT 1;

    IF v_a_cat IS NOT NULL THEN
      -- Pick two unseen from this category
      SELECT id, image_url INTO v_a_id, v_a_url
        FROM comparison_images ci
       WHERE ci.is_dead = false
         AND ci.category_slug = v_a_cat
         AND ci.id <> ALL(v_used)
         AND NOT EXISTS (SELECT 1 FROM comparison_seen_log s WHERE s.user_id = v_user AND s.image_id = ci.id)
       ORDER BY random() LIMIT 1;

      SELECT id, image_url INTO v_b_id, v_b_url
        FROM comparison_images ci
       WHERE ci.is_dead = false
         AND ci.category_slug = v_a_cat
         AND ci.id <> v_a_id
         AND ci.id <> ALL(v_used)
         AND NOT EXISTS (SELECT 1 FROM comparison_seen_log s WHERE s.user_id = v_user AND s.image_id = ci.id)
       ORDER BY random() LIMIT 1;
    END IF;

    -- TIER 2: category with ≥1 unseen + ≥1 seen (mixed)
    IF v_a_id IS NULL OR v_b_id IS NULL THEN
      v_a_id := NULL; v_b_id := NULL; v_a_cat := NULL;

      SELECT ci.category_slug INTO v_a_cat
        FROM comparison_images ci
       WHERE ci.is_dead = false
         AND ci.id <> ALL(v_used)
       GROUP BY ci.category_slug
       HAVING COUNT(*) >= 2
          AND COUNT(*) FILTER (
            WHERE NOT EXISTS (SELECT 1 FROM comparison_seen_log s WHERE s.user_id = v_user AND s.image_id = ci.id)
          ) >= 1
       ORDER BY random() LIMIT 1;

      IF v_a_cat IS NOT NULL THEN
        -- A = unseen from this category
        SELECT id, image_url INTO v_a_id, v_a_url
          FROM comparison_images ci
         WHERE ci.is_dead = false
           AND ci.category_slug = v_a_cat
           AND ci.id <> ALL(v_used)
           AND NOT EXISTS (SELECT 1 FROM comparison_seen_log s WHERE s.user_id = v_user AND s.image_id = ci.id)
         ORDER BY random() LIMIT 1;

        -- B = any other image from same category (seen or unseen)
        SELECT id, image_url INTO v_b_id, v_b_url
          FROM comparison_images ci
         WHERE ci.is_dead = false
           AND ci.category_slug = v_a_cat
           AND ci.id <> v_a_id
           AND ci.id <> ALL(v_used)
         ORDER BY random() LIMIT 1;
      END IF;
    END IF;

    -- TIER 3: any same-category pair (both seen)
    IF v_a_id IS NULL OR v_b_id IS NULL THEN
      v_a_id := NULL; v_b_id := NULL; v_a_cat := NULL;

      SELECT ci.category_slug INTO v_a_cat
        FROM comparison_images ci
       WHERE ci.is_dead = false
         AND ci.id <> ALL(v_used)
       GROUP BY ci.category_slug
       HAVING COUNT(*) >= 2
       ORDER BY random() LIMIT 1;

      EXIT WHEN v_a_cat IS NULL;

      SELECT id, image_url INTO v_a_id, v_a_url
        FROM comparison_images
       WHERE is_dead = false AND category_slug = v_a_cat AND id <> ALL(v_used)
       ORDER BY random() LIMIT 1;

      SELECT id, image_url INTO v_b_id, v_b_url
        FROM comparison_images
       WHERE is_dead = false AND category_slug = v_a_cat
         AND id <> v_a_id AND id <> ALL(v_used)
       ORDER BY random() LIMIT 1;
    END IF;

    EXIT WHEN v_a_id IS NULL OR v_b_id IS NULL;

    v_used := array_append(v_used, v_a_id);
    v_used := array_append(v_used, v_b_id);

    SELECT name INTO v_a_cat_name FROM comparison_categories WHERE slug = v_a_cat;

    v_pairs := v_pairs || jsonb_build_array(jsonb_build_object(
      'category_slug', v_a_cat,
      'category_name', COALESCE(v_a_cat_name, v_a_cat),
      'image_a', jsonb_build_object('id', v_a_id, 'url', v_a_url),
      'image_b', jsonb_build_object('id', v_b_id, 'url', v_b_url)
    ));
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_enough_images');
  END IF;

  -- Log every served image as seen for this user
  INSERT INTO comparison_seen_log(user_id, image_id, seen_at)
  SELECT v_user, unnest(v_used), now()
  ON CONFLICT (user_id, image_id) DO UPDATE SET seen_at = EXCLUDED.seen_at;

  v_task := get_daily_task(v_user);
  RETURN jsonb_build_object('success', true, 'pairs', v_pairs, 'task', v_task);
END $function$;