ALTER TYPE public.transaction_type RENAME TO transaction_type_old;

CREATE TYPE public.transaction_type AS ENUM (
  'membership_bonus','deposit','withdrawal','debt_reversal','platform_fee',
  'subsidy','membership_fee','referral_payout','voucher_issuance','credit_redemption',
  'admin_expense','welcome_bonus','drop_entry','drop_profit','drop_reentry',
  'drop_referral_cycle','referral_first_cycle_bonus','task_earning','task_unlock'
);

ALTER TABLE public.transactions
  ALTER COLUMN transaction_type TYPE public.transaction_type
  USING transaction_type::text::public.transaction_type;

DROP FUNCTION IF EXISTS public.write_transaction(numeric, text, public.transaction_type_old, uuid, public.wallet_type, jsonb, public.transaction_status);

DROP TYPE public.transaction_type_old;

CREATE OR REPLACE FUNCTION public.write_transaction(
  _amount numeric,
  _description text,
  _transaction_type public.transaction_type,
  _user_id uuid,
  _wallet_type public.wallet_type,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _status public.transaction_status DEFAULT 'completed'::public.transaction_status
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tx_id uuid;
BEGIN
  INSERT INTO public.transactions (
    user_id, wallet_type, amount, transaction_type, description, metadata, status
  ) VALUES (
    _user_id, _wallet_type, _amount, _transaction_type, _description, _metadata, _status
  )
  RETURNING id INTO _tx_id;

  RETURN _tx_id;
END;
$function$;