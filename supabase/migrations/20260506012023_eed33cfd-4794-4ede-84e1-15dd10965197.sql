CREATE OR REPLACE FUNCTION public.admin_grant_bonus_batches(_user_id uuid, _bonus integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_new_bonus integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'admin role required');
  END IF;

  IF _bonus IS NULL OR _bonus <= 0 OR _bonus > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'bonus must be 1..100');
  END IF;

  INSERT INTO public.daily_task (user_id, task_date, batches_done, bonus_batches)
  VALUES (_user_id, v_today, 0, _bonus)
  ON CONFLICT (user_id, task_date)
  DO UPDATE SET
    bonus_batches = public.daily_task.bonus_batches + EXCLUDED.bonus_batches,
    updated_at = now()
  RETURNING bonus_batches INTO v_new_bonus;

  INSERT INTO public.notifications (user_id, notification_type, title, message, link)
  VALUES (
    _user_id,
    'task_bonus_granted',
    'You got bonus batches!',
    'An admin gave you +' || _bonus || ' bonus batches for today. Open Daily Task to use them.',
    '/task'
  );

  RETURN jsonb_build_object(
    'success', true,
    'granted', _bonus,
    'bonus_batches_today', v_new_bonus
  );
END;
$function$;