-- Moniepoint pipeline hardening (bulletproof pass)

-- 1) name_tokens with stopword filter
CREATE OR REPLACE FUNCTION public.name_tokens(_name text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT DISTINCT t
      FROM unnest(
        regexp_split_to_array(
          lower(regexp_replace(COALESCE(_name, ''), '[^a-zA-Z0-9\s]', ' ', 'g')),
          '\s+'
        )
      ) AS t
      WHERE length(t) > 1
        AND t NOT IN (
          'mr','mrs','miss','ms','dr','prof','chief','alhaji','alhaja',
          'engr','barr','hon','rev','pastor','elder','sir','madam',
          'from','transfer','transfers','via','bank','date','time',
          'narration','sender','name','account','number','balance','credit'
        )
    ),
    ARRAY[]::text[]
  )
$$;

-- 2) Atomic matcher v2: ±5 tolerance; does NOT resolve unmatched row
CREATE OR REPLACE FUNCTION public.match_and_credit_moniepoint(
  _amount numeric,
  _sender_name text,
  _email_id text,
  _unmatched_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sender_tokens text[];
  _winner_id uuid;
  _winner_user uuid;
  _winner_purpose text;
  _winner_created timestamptz;
  _winner_expected numeric;
  _top_score int;
  _tie_count int;
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
  )
  SELECT id, user_id, purpose, created_at, expected_amount, (SELECT s FROM top),
         (SELECT count(*) FROM ranked WHERE score = (SELECT s FROM top) AND amount_delta = 0)
    INTO _winner_id, _winner_user, _winner_purpose, _winner_created, _winner_expected, _top_score, _tie_count
  FROM ranked
  WHERE score = (SELECT s FROM top)
  ORDER BY amount_delta ASC, created_at DESC
  LIMIT 1;

  IF _winner_id IS NULL THEN
    RETURN jsonb_build_object('matched', false, 'reason', 'not_found');
  END IF;

  IF _tie_count > 1 THEN
    RETURN jsonb_build_object('matched', false, 'reason', 'ambiguous', 'tie_count', _tie_count);
  END IF;

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
           'matched_amount_delta', _amount - _winner_expected
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
$$;

REVOKE ALL ON FUNCTION public.match_and_credit_moniepoint(numeric, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_and_credit_moniepoint(numeric, text, text, uuid) TO service_role;

-- 3) Schedule expire_stale_payment_attempts() every 15 minutes via pg_cron
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
      FROM cron.job
     WHERE jobname = 'expire-stale-payment-attempts';

    PERFORM cron.schedule(
      'expire-stale-payment-attempts',
      '*/15 * * * *',
      $cron$SELECT public.expire_stale_payment_attempts();$cron$
    );
  END IF;
END $$;