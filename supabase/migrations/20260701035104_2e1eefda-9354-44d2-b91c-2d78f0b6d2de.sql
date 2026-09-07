
-- 1. Partial unique index for email idempotency
CREATE UNIQUE INDEX IF NOT EXISTS unmatched_moniepoint_payments_txref_unique_idx
  ON public.unmatched_moniepoint_payments (transaction_reference)
  WHERE transaction_reference IS NOT NULL;

-- 2. Helper: normalize a full name into a distinct array of lowercase tokens (length > 1)
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
    ),
    ARRAY[]::text[]
  )
$$;

-- 3. Helper: fail sibling pending membership attempts (used by admin flows too)
CREATE OR REPLACE FUNCTION public.fail_stale_membership_attempts(
  _user_id uuid,
  _except_id uuid,
  _reason text DEFAULT 'superseded'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  UPDATE public.payment_attempts
     SET status = 'failed',
         metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
           'superseded_by', _except_id,
           'superseded_reason', _reason,
           'superseded_at', now()
         )
   WHERE user_id = _user_id
     AND id <> _except_id
     AND status = 'pending'
     AND purpose = 'membership';
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.fail_stale_membership_attempts(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_stale_membership_attempts(uuid, uuid, text) TO service_role;

-- 4. The atomic matcher
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
  _top_score int;
  _tie_count int;
  _payment_ref text;
BEGIN
  _sender_tokens := public.name_tokens(_sender_name);
  IF array_length(_sender_tokens, 1) IS NULL THEN
    RETURN jsonb_build_object('matched', false, 'reason', 'not_found');
  END IF;

  -- Score all candidate attempts (locked so parallel webhooks can't grab the same row)
  WITH candidates AS (
    SELECT pa.id, pa.user_id, pa.purpose, pa.created_at,
           cardinality(
             ARRAY(
               SELECT unnest(public.name_tokens(pr.full_name))
               INTERSECT
               SELECT unnest(_sender_tokens)
             )
           ) AS score
    FROM public.payment_attempts pa
    JOIN public.profiles pr ON pr.id = pa.user_id
    WHERE pa.amount = _amount
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
  SELECT id, user_id, purpose, created_at, (SELECT s FROM top),
         (SELECT count(*) FROM ranked WHERE score = (SELECT s FROM top))
    INTO _winner_id, _winner_user, _winner_purpose, _winner_created, _top_score, _tie_count
  FROM ranked
  WHERE score = (SELECT s FROM top)
  ORDER BY created_at DESC
  LIMIT 1;

  IF _winner_id IS NULL THEN
    RETURN jsonb_build_object('matched', false, 'reason', 'not_found');
  END IF;

  IF _tie_count > 1 THEN
    RETURN jsonb_build_object('matched', false, 'reason', 'ambiguous', 'tie_count', _tie_count);
  END IF;

  _payment_ref := 'MNP-EMAIL-' || _email_id;

  -- Mark winner verified
  UPDATE public.payment_attempts
     SET status = 'verified',
         verified_at = now(),
         metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
           'matched_via', 'email_webhook',
           'matched_email_id', _email_id,
           'matched_sender_name', _sender_name,
           'matched_unmatched_id', _unmatched_id
         )
   WHERE id = _winner_id;

  -- Supersede stale siblings per purpose rules
  IF _winner_purpose = 'membership' THEN
    PERFORM public.fail_stale_membership_attempts(_winner_user, _winner_id, 'email_match_won');
  ELSE
    -- deposit purpose: only kill drafts older than 10 minutes
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

  -- Resolve the unmatched audit row
  UPDATE public.unmatched_moniepoint_payments
     SET resolved = true,
         resolved_user_id = _winner_user,
         resolved_at = now()
   WHERE id = _unmatched_id;

  RETURN jsonb_build_object(
    'matched', true,
    'attempt_id', _winner_id,
    'user_id', _winner_user,
    'purpose', _winner_purpose,
    'payment_ref', _payment_ref,
    'paid_amount', _amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.match_and_credit_moniepoint(numeric, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_and_credit_moniepoint(numeric, text, text, uuid) TO service_role;
