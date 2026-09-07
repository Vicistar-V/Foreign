CREATE OR REPLACE FUNCTION public.get_pending_balance(_user_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT GREATEST(COALESCE(SUM(amount), 0)::numeric, 0::numeric)
  FROM public.transactions
  WHERE user_id = _user_id
    AND wallet_type = 'pending'::wallet_type;
$function$;

CREATE OR REPLACE FUNCTION public.consume_pending_for_cycle(_user_id uuid, _profit_target numeric, _spot_id uuid, _drop_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_available numeric; v_payable numeric;
BEGIN
  IF _user_id IS NULL OR _profit_target IS NULL OR _profit_target <= 0 THEN
    RETURN jsonb_build_object('paid', 0, 'target', COALESCE(_profit_target,0), 'forfeited', 0);
  END IF;
  PERFORM 1 FROM public.transactions
   WHERE user_id=_user_id AND wallet_type='pending'::wallet_type
   FOR UPDATE;
  v_available := public.get_pending_balance(_user_id);
  v_payable := LEAST(_profit_target, v_available);
  IF v_payable <= 0 THEN
    RETURN jsonb_build_object('paid', 0, 'target', _profit_target, 'forfeited', _profit_target);
  END IF;
  INSERT INTO public.transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES (_user_id,'pending'::wallet_type,-v_payable,'task_unlock'::transaction_type,
    'Daily earnings applied to machine payout','completed'::transaction_status,
    jsonb_build_object('spot_id',_spot_id,'drop_id',_drop_id,'amount',v_payable));
  INSERT INTO public.transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
  VALUES (_user_id,'earnings'::wallet_type,v_payable,'drop_profit'::transaction_type,
    'Machine payout (ready to withdraw)','completed'::transaction_status,
    jsonb_build_object('spot_id',_spot_id,'drop_id',_drop_id,'amount',v_payable,'target',_profit_target));
  RETURN jsonb_build_object('paid', v_payable, 'target', _profit_target, 'forfeited', _profit_target - v_payable);
END;
$function$;