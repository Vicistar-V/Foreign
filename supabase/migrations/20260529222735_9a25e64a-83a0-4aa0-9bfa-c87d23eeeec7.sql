CREATE OR REPLACE FUNCTION public.atomic_admin_adjust_balance(
  _user_id uuid,
  _amount numeric,
  _wallet_type wallet_type,
  _operation text,
  _reason text,
  _admin_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_name TEXT;
  v_signed_amount NUMERIC;
  v_current_balance NUMERIC;
  v_tx_type transaction_type;
  v_description TEXT;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  IF _wallet_type NOT IN ('earnings'::wallet_type, 'deposit'::wallet_type, 'pending'::wallet_type) THEN
    RAISE EXCEPTION 'Only earnings, deposit and pending wallets can be adjusted';
  END IF;

  IF _operation NOT IN ('add', 'remove') THEN
    RAISE EXCEPTION 'Operation must be add or remove';
  END IF;

  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = _user_id;
  IF v_user_name IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF _operation = 'add' THEN
    v_signed_amount := _amount;
    v_tx_type := 'membership_bonus'::transaction_type;
    v_description := 'Admin added money: ' || _reason;
  ELSE
    v_signed_amount := -_amount;
    v_tx_type := 'admin_expense'::transaction_type;
    v_description := 'Admin removed money: ' || _reason;

    -- Make sure we don't push balance negative
    SELECT COALESCE(SUM(amount), 0) INTO v_current_balance
    FROM public.transactions
    WHERE user_id = _user_id AND wallet_type = _wallet_type;

    IF v_current_balance + v_signed_amount < 0 THEN
      RAISE EXCEPTION 'Not enough balance. Current %: %, trying to remove: %', _wallet_type, v_current_balance, _amount;
    END IF;
  END IF;

  INSERT INTO public.transactions (
    user_id, wallet_type, amount, transaction_type, description, status, metadata
  ) VALUES (
    _user_id, _wallet_type, v_signed_amount, v_tx_type,
    v_description, 'completed'::transaction_status,
    jsonb_build_object(
      'admin_action', true,
      'admin_id', _admin_id,
      'operation', _operation,
      'reason', _reason,
      'adjusted_at', NOW()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_name', v_user_name,
    'amount', _amount,
    'wallet_type', _wallet_type,
    'operation', _operation
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.atomic_admin_adjust_balance(uuid, numeric, wallet_type, text, text, uuid) TO service_role;