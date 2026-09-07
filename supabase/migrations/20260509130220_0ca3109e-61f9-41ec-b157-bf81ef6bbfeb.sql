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
  v_safety int := 0;
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

  WHILE v_count < v_batch_size AND v_safety < 200 LOOP
    v_safety := v_safety + 1;

    -- Pick a random category that has at least 2 live, unused images
    SELECT ci.category_slug
      INTO v_a_cat
      FROM comparison_images ci
     WHERE ci.is_dead = false
       AND ci.id <> ALL(v_used_imgs)
     GROUP BY ci.category_slug
     HAVING COUNT(*) >= 2
     ORDER BY random()
     LIMIT 1;

    EXIT WHEN v_a_cat IS NULL;

    -- Pick image A from that category
    SELECT id, image_url
      INTO v_a_id, v_a_url
      FROM comparison_images
     WHERE is_dead = false
       AND category_slug = v_a_cat
       AND id <> ALL(v_used_imgs)
     ORDER BY random() LIMIT 1;

    EXIT WHEN v_a_id IS NULL;

    -- Pick image B from the SAME category, different image
    SELECT id, image_url
      INTO v_b_id, v_b_url
      FROM comparison_images
     WHERE is_dead = false
       AND category_slug = v_a_cat
       AND id <> v_a_id
       AND id <> ALL(v_used_imgs)
     ORDER BY random() LIMIT 1;

    -- If no partner in same category (shouldn't happen due to HAVING), skip
    IF v_b_id IS NULL THEN
      v_used_imgs := array_append(v_used_imgs, v_a_id);
      v_a_id := NULL;
      CONTINUE;
    END IF;

    v_used_imgs := array_append(v_used_imgs, v_a_id);
    v_used_imgs := array_append(v_used_imgs, v_b_id);

    SELECT name INTO v_a_cat_name FROM comparison_categories WHERE slug = v_a_cat;

    v_pairs := v_pairs || jsonb_build_array(jsonb_build_object(
      'category_slug', v_a_cat,
      'category_name', COALESCE(v_a_cat_name, v_a_cat),
      'image_a', jsonb_build_object('id', v_a_id, 'url', v_a_url),
      'image_b', jsonb_build_object('id', v_b_id, 'url', v_b_url)
    ));
    v_count := v_count + 1;
    v_a_id := NULL; v_b_id := NULL; v_a_cat := NULL;
  END LOOP;

  IF v_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_enough_images');
  END IF;

  v_task := get_daily_task(v_user);
  RETURN jsonb_build_object('success', true, 'pairs', v_pairs, 'task', v_task);
END $function$;