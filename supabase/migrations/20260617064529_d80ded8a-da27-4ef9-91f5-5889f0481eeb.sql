
CREATE OR REPLACE FUNCTION public.track_broadcast_cta_click(_notification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_meta jsonb;
  v_count int;
  v_now timestamptz := now();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not signed in');
  END IF;

  SELECT metadata INTO v_meta
  FROM public.notifications
  WHERE id = _notification_id AND user_id = v_uid;

  IF v_meta IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Notification not found');
  END IF;

  v_count := COALESCE((v_meta->>'cta_click_count')::int, 0) + 1;

  UPDATE public.notifications
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'cta_click_count', v_count,
    'cta_last_clicked_at', v_now,
    'cta_first_clicked_at', COALESCE(metadata->>'cta_first_clicked_at', v_now::text)
  )
  WHERE id = _notification_id AND user_id = v_uid;

  RETURN jsonb_build_object('success', true, 'clicks', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_broadcast_cta_click(uuid) TO authenticated;
