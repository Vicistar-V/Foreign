DROP FUNCTION IF EXISTS public.task_submit_batch(jsonb);

CREATE OR REPLACE FUNCTION public.task_submit_batch(_choices jsonb DEFAULT NULL::jsonb)
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