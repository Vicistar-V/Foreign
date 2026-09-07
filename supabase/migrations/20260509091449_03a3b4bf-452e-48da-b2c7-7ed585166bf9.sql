
-- Drop the old per-vote RPC; the front end will no longer record individual picks
DROP FUNCTION IF EXISTS public.task_submit_vote(uuid, text, integer);

-- New batch submit: records all picks in one shot AND completes the batch
CREATE OR REPLACE FUNCTION public.task_submit_batch(_votes jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'Africa/Lagos')::date;
  v_batch_result jsonb;
  v_new_batch_number int;
  v_vote jsonb;
  v_idx int := 0;
  v_tok comparison_pair_tokens%ROWTYPE;
  v_pair_token uuid;
  v_winner_pick text;
  v_decision_ms int;
  v_winner_id uuid;
  v_elo_a numeric; v_elo_b numeric;
  v_expected_a numeric; v_expected_b numeric;
  v_score_a numeric; v_score_b numeric;
  v_k constant numeric := 24;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'auth');
  END IF;
  IF _votes IS NULL OR jsonb_typeof(_votes) <> 'array' OR jsonb_array_length(_votes) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_votes');
  END IF;

  -- Atomically claim a batch slot for today (also enforces loader anti-spam)
  v_batch_result := public.task_complete_batch();
  IF NOT COALESCE((v_batch_result->>'success')::boolean, false) THEN
    RETURN v_batch_result;
  END IF;

  v_new_batch_number := COALESCE((v_batch_result->>'batches_done')::int, 0);

  FOR v_vote IN SELECT * FROM jsonb_array_elements(_votes)
  LOOP
    v_idx := v_idx + 1;
    v_pair_token := NULLIF(v_vote->>'pair_token','')::uuid;
    v_winner_pick := v_vote->>'winner';
    v_decision_ms := GREATEST(0, COALESCE((v_vote->>'decision_ms')::int, 0));

    IF v_pair_token IS NULL OR v_winner_pick NOT IN ('a','b') THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_tok
      FROM comparison_pair_tokens
     WHERE token = v_pair_token AND user_id = v_user;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_winner_id := CASE WHEN v_winner_pick = 'a' THEN v_tok.image_a_id ELSE v_tok.image_b_id END;

    INSERT INTO comparison_votes
      (user_id, category_slug, image_a_id, image_b_id, winner_id, decision_ms,
       task_date, batch_number, vote_in_batch)
    VALUES
      (v_user, v_tok.category_slug, v_tok.image_a_id, v_tok.image_b_id, v_winner_id, v_decision_ms,
       v_today, v_new_batch_number, v_idx);

    SELECT elo_score INTO v_elo_a FROM comparison_images WHERE id = v_tok.image_a_id FOR UPDATE;
    SELECT elo_score INTO v_elo_b FROM comparison_images WHERE id = v_tok.image_b_id FOR UPDATE;
    IF v_elo_a IS NULL OR v_elo_b IS NULL THEN
      DELETE FROM comparison_pair_tokens WHERE token = v_pair_token;
      CONTINUE;
    END IF;

    v_expected_a := 1.0 / (1.0 + power(10, (v_elo_b - v_elo_a) / 400.0));
    v_expected_b := 1.0 - v_expected_a;
    v_score_a := CASE WHEN v_winner_pick = 'a' THEN 1 ELSE 0 END;
    v_score_b := 1 - v_score_a;

    UPDATE comparison_images
       SET elo_score = v_elo_a + v_k * (v_score_a - v_expected_a),
           votes_count = votes_count + 1,
           wins_count = wins_count + (CASE WHEN v_winner_pick = 'a' THEN 1 ELSE 0 END)
     WHERE id = v_tok.image_a_id;

    UPDATE comparison_images
       SET elo_score = v_elo_b + v_k * (v_score_b - v_expected_b),
           votes_count = votes_count + 1,
           wins_count = wins_count + (CASE WHEN v_winner_pick = 'b' THEN 1 ELSE 0 END)
     WHERE id = v_tok.image_b_id;

    DELETE FROM comparison_pair_tokens WHERE token = v_pair_token;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'batch', v_batch_result,
    'task', public.get_daily_task(v_user)
  );
END
$$;
