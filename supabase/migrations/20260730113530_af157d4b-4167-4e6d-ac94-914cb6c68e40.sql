CREATE OR REPLACE FUNCTION public.notify_reentry_processed(_user_id uuid, _spot_name text, _drop_position integer)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  INSERT INTO notifications (user_id, title, message, notification_type, link, metadata)
  VALUES (
    _user_id,
    'New campaign started',
    'Your ad share has joined a new campaign. Pick your pictures each day and watch it move to 100%.',
    'drop_joined',
    '/dashboard',
    json_build_object('spot_name', _spot_name, 'position', _drop_position)
  );
$function$;

CREATE OR REPLACE FUNCTION public.send_overflow_notification(_user_id uuid, _recycled_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM create_notification(
    _user_id,
    'Your campaign moved faster',
    'Extra ₦' || _recycled_amount::TEXT || ' pushed your campaign closer to 100%. Tell a friend and it moves even faster.',
    'velocity_overflow',
    NULL,
    NULL
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_payout_notification(_user_id uuid, _profit_amount numeric, _auto_compound boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM create_notification(
    _user_id := _user_id,
    _type := 'drop_payout',
    _title := 'Your share has paid',
    _message := CASE
      WHEN _auto_compound THEN
        format('₦%s has been used to activate another ad share for you.', _profit_amount)
      ELSE
        format('₦%s is ready to withdraw to your bank.', _profit_amount)
    END
  );
END;
$function$;