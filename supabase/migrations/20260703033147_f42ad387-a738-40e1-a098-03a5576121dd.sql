CREATE OR REPLACE FUNCTION public.match_and_credit_moniepoint(_amount numeric, _sender_name text, _email_id text, _unmatched_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _sender_tokens text[];
  _winner_id uuid;
  _winner_user uuid;
  _winner_purpose text;
  _winner_created timestamptz;
  _winner_expected numeric;
  _top_score int;
  _tie_count int;
  _distinct_users int;
  _payment_ref text;
BEGIN
  _sender_tokens := public.name_tokens(_sender_name);
  IF array_length(_sender_tokens, 1) IS NULL THEN
    RETURN jsonb_build_object('matched', false, 'reason', 'not_found');
  END IF;

  WITH candidates AS (
    SELECT pa.id, pa.user_id, pa.purpose, pa.created_at, pa.amount AS expected_amount,
           cardinality(
             ARRAY(
               SELECT unnest(public.name_tokens(pr.full_name))
               INTERSECT
               SELECT unnest(_sender_tokens)
             )
           ) AS score,
           abs(pa.amount - _amount) AS amount_delta
    FROM public.payment_attempts pa
    JOIN public.profiles pr ON pr.id = pa.user_id
    WHERE pa.amount BETWEEN (_amount - 5) AND (_amount + 5)
      AND pa.status = 'pending'
      AND pa.provider = 'moniepoint'
      AND pa.created_at > now() - interval '24 hours'
    ORDER BY pa.created_at DESC
    FOR UPDATE OF pa SKIP LOCKED
  ),
  ranked AS (
    SELECT * FROM candidates WHERE score >= 1
  ),
  top AS (
    SELECT max(score) AS s FROM ranked
  ),
  top_rows AS (
    SELECT * FROM ranked
    WHERE score = (SELECT s FROM top)
      AND amount_delta = 0
  )
  SELECT id, user_id, purpose, created_at, expected_amount,
         (SELECT s FROM top),
         (SELECT count(*) FROM top_rows),
         (SELECT count(DISTINCT user_id) FROM top_rows)
    INTO _winner_id, _winner_user, _winner_purpose, _winner_created, _winner_expected,
         _top_score, _tie_count, _distinct_users
  FROM top_rows
  ORDER BY created_at DESC
  LIMIT 1;

  IF _winner_id IS NULL THEN
    -- fall back: no exact-amount top row, try nearest amount
    SELECT id, user_id, purpose, created_at, expected_amount
      INTO _winner_id, _winner_user, _winner_purpose, _winner_created, _winner_expected
    FROM (
      WITH candidates AS (
        SELECT pa.id, pa.user_id, pa.purpose, pa.created_at, pa.amount AS expected_amount,
               cardinality(
                 ARRAY(
                   SELECT unnest(public.name_tokens(pr.full_name))
                   INTERSECT
                   SELECT unnest(_sender_tokens)
                 )
               ) AS score,
               abs(pa.amount - _amount) AS amount_delta
        FROM public.payment_attempts pa
        JOIN public.profiles pr ON pr.id = pa.user_id
        WHERE pa.amount BETWEEN (_amount - 5) AND (_amount + 5)
          AND pa.status = 'pending'
          AND pa.provider = 'moniepoint'
          AND pa.created_at > now() - interval '24 hours'
      )
      SELECT * FROM candidates WHERE score >= 1
      ORDER BY score DESC, amount_delta ASC, created_at DESC
      LIMIT 1
    ) x;

    IF _winner_id IS NULL THEN
      RETURN jsonb_build_object('matched', false, 'reason', 'not_found');
    END IF;
  ELSIF _tie_count > 1 AND _distinct_users > 1 THEN
    -- Real ambiguity: multiple DIFFERENT users tied. Refuse.
    RETURN jsonb_build_object('matched', false, 'reason', 'ambiguous', 'tie_count', _tie_count);
  END IF;
  -- If _tie_count > 1 but _distinct_users = 1, same user retried — safe to credit newest.

  _payment_ref := 'MNP-EMAIL-' || _email_id;

  UPDATE public.payment_attempts
     SET status = 'verified',
         verified_at = now(),
         metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
           'matched_via', 'email_webhook',
           'matched_email_id', _email_id,
           'matched_sender_name', _sender_name,
           'matched_unmatched_id', _unmatched_id,
           'matched_amount_paid', _amount,
           'matched_amount_expected', _winner_expected,
           'matched_amount_delta', _amount - _winner_expected,
           'matched_tie_same_user', _tie_count > 1
         )
   WHERE id = _winner_id;

  IF _winner_purpose = 'membership' THEN
    PERFORM public.fail_stale_membership_attempts(_winner_user, _winner_id, 'email_match_won');
  ELSE
    UPDATE public.payment_attempts
       SET status = 'failed',
           metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
             'superseded_by', _winner_id,
             'superseded_reason', 'stale_deposit_draft',
             'superseded_at', now()
           )
     WHERE user_id = _winner_user
       AND id <> _winner_id
       AND status = 'pending'
       AND purpose = 'deposit'
       AND created_at < _winner_created - interval '10 minutes';
  END IF;

  RETURN jsonb_build_object(
    'matched', true,
    'attempt_id', _winner_id,
    'user_id', _winner_user,
    'purpose', _winner_purpose,
    'payment_ref', _payment_ref,
    'paid_amount', _amount,
    'expected_amount', _winner_expected,
    'unmatched_id', _unmatched_id
  );
END;
$function$;