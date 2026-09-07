-- 1) Drop dead/legacy functions first (they reference tables we're about to drop)
DROP FUNCTION IF EXISTS public.record_comparison_vote(uuid, text, uuid, uuid, text, integer);
DROP FUNCTION IF EXISTS public.task_complete_batch();
DROP FUNCTION IF EXISTS public.task_get_pair();
DROP FUNCTION IF EXISTS public.task_submit_batch(jsonb);
DROP FUNCTION IF EXISTS public.task_get_batch(integer);

-- 2) Drop tracking tables that nothing reads
DROP TABLE IF EXISTS public.comparison_votes;
DROP TABLE IF EXISTS public.comparison_pair_tokens;

-- 3) Drop unused Elo / ranking columns on the image library
ALTER TABLE public.comparison_images
  DROP COLUMN IF EXISTS elo_score,
  DROP COLUMN IF EXISTS wins_count,
  DROP COLUMN IF EXISTS votes_count;

-- 4) Rebuild task_get_batch — pure image picker, no tokens, no vote-history filter
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
  v_used_imgs uuid[] := ARRAY[]::uuid[];
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

  WHILE v_count < v_batch_size LOOP
    SELECT id, image_url, category_slug
      INTO v_a_id, v_a_url, v_a_cat
      FROM comparison_images
     WHERE is_dead = false
       AND id <> ALL(v_used_imgs)
     ORDER BY random() LIMIT 1;

    EXIT WHEN v_a_id IS NULL;

    SELECT id, image_url INTO v_b_id, v_b_url
      FROM comparison_images
     WHERE is_dead = false
       AND id <> v_a_id
       AND id <> ALL(v_used_imgs)
     ORDER BY random() LIMIT 1;

    EXIT WHEN v_b_id IS NULL;

    v_used_imgs := array_append(v_used_imgs, v_a_id);
    v_used_imgs := array_append(v_used_imgs, v_b_id);

    SELECT name INTO v_a_cat_name FROM comparison_categories WHERE slug = v_a_cat;

    v_pairs := v_pairs || jsonb_build_array(jsonb_build_object(
      'category_slug', COALESCE(v_a_cat, 'mixed'),
      'category_name', COALESCE(v_a_cat_name, 'Pick one'),
      'image_a', jsonb_build_object('id', v_a_id, 'url', v_a_url),
      'image_b', jsonb_build_object('id', v_b_id, 'url', v_b_url)
    ));
    v_count := v_count + 1;
    v_a_id := NULL; v_b_id := NULL;
  END LOOP;

  IF v_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_enough_images');
  END IF;

  v_task := get_daily_task(v_user);
  RETURN jsonb_build_object('success', true, 'pairs', v_pairs, 'task', v_task);
END $function$;

-- 5) Rebuild task_submit_batch — just records that one batch was completed.
--    The _votes argument is ignored (kept for backwards compatibility during deploy);
--    the platform doesn't need the actual picks.
CREATE OR REPLACE FUNCTION public.task_submit_batch(_votes jsonb DEFAULT NULL::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_batch_result jsonb;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'auth');
  END IF;

  v_batch_result := public.complete_batch(v_user);
  IF NOT COALESCE((v_batch_result->>'success')::boolean, false) THEN
    RETURN v_batch_result;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'batch', v_batch_result,
    'task', public.get_daily_task(v_user)
  );
END $function$;