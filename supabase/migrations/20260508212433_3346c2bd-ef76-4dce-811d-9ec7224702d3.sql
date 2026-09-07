CREATE OR REPLACE FUNCTION public.task_report_broken_image(_image_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_count int;
  v_threshold int := 3;
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

  -- Auto-hide if enough distinct people reported it
  SELECT COUNT(DISTINCT reporter_id) INTO v_count
    FROM comparison_broken_reports
   WHERE image_id = _image_id;

  IF v_count >= v_threshold THEN
    UPDATE comparison_images
       SET is_dead = true
     WHERE id = _image_id AND is_dead = false;
  END IF;

  RETURN jsonb_build_object('success', true, 'reports', v_count, 'auto_hidden', v_count >= v_threshold);
END $function$;

-- Prevent duplicate (image, reporter) reports so the threshold is meaningful
CREATE UNIQUE INDEX IF NOT EXISTS comparison_broken_reports_unique
  ON public.comparison_broken_reports (image_id, reporter_id);