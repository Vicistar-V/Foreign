CREATE OR REPLACE FUNCTION public.get_my_profile()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_profile jsonb;
  v_pin_hash text;
  v_has_pin boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT jsonb_build_object(
    'id', id,
    'full_name', full_name,
    'avatar_url', avatar_url,
    'is_member', is_member,
    'is_banned', is_banned,
    'banned_reason', banned_reason,
    'is_name_locked', is_name_locked,
    'referral_code', referral_code,
    'phone_number', phone_number,
    'auto_compound_enabled', auto_compound_enabled,
    'last_payout_at', last_payout_at,
    'last_seen_at', last_seen_at,
    'created_at', created_at,
    'activated_at', activated_at,
    'has_seen_explainer', has_seen_explainer,
    'birth_year', birth_year,
    'birth_month', birth_month,
    'state_of_residence', state_of_residence
  ) INTO v_profile
  FROM public.profiles
  WHERE id = v_uid;

  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT pin_hash INTO v_pin_hash
  FROM public.user_pin_secrets
  WHERE user_id = v_uid;

  v_has_pin := v_pin_hash IS NOT NULL AND left(v_pin_hash, 2) = '$2';

  RETURN v_profile || jsonb_build_object('has_pin', v_has_pin);
END;
$function$;