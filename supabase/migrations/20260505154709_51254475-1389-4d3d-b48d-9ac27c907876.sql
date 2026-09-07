CREATE OR REPLACE FUNCTION public.commit_distribution_batch(_writes jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx JSONB;
  v_drop_fill JSONB;
  v_notification JSONB;
  v_profile_update JSONB;
  v_spot_stat JSONB;
  v_reentry JSONB;
  v_new_drop JSONB;
  v_new_spot JSONB;
  v_genesis JSONB;
  v_compound JSONB;
  v_drop_paid UUID;
  v_drop_settled UUID;
  v_created_ids JSONB := '{"transactions": [], "notifications": [], "drops": [], "spots": [], "genesis_results": [], "compound_results": []}'::JSONB;
  v_tx_id UUID;
  v_notif_id UUID;
  v_drop_id UUID;
  v_spot_id UUID;
  v_genesis_result JSONB;
  v_compound_result JSONB;
BEGIN
  IF _writes ? 'transactions' THEN
    FOR v_tx IN SELECT * FROM jsonb_array_elements(_writes->'transactions')
    LOOP
      SELECT write_transaction(
        (v_tx->>'user_id')::UUID,
        (v_tx->>'amount')::NUMERIC,
        (v_tx->>'transaction_type')::transaction_type,
        (v_tx->>'wallet_type')::wallet_type,
        v_tx->>'description',
        COALESCE((v_tx->>'status')::transaction_status, 'completed'),
        COALESCE(v_tx->'metadata', '{}')
      ) INTO v_tx_id;
      v_created_ids := jsonb_set(v_created_ids, '{transactions}', v_created_ids->'transactions' || jsonb_build_array(v_tx_id));
    END LOOP;
  END IF;

  IF _writes ? 'drop_fills' THEN
    FOR v_drop_fill IN SELECT * FROM jsonb_array_elements(_writes->'drop_fills')
    LOOP
      PERFORM write_drop_fill(
        (v_drop_fill->>'drop_id')::UUID,
        (v_drop_fill->>'new_fill_amount')::NUMERIC,
        v_drop_fill->>'new_status',
        NULLIF(v_drop_fill->>'completed_at', '')::TIMESTAMPTZ
      );
    END LOOP;
  END IF;

  IF _writes ? 'drop_paids' THEN
    FOR v_drop_paid IN SELECT * FROM jsonb_array_elements_text(_writes->'drop_paids')
    LOOP
      PERFORM write_drop_paid(v_drop_paid);
    END LOOP;
  END IF;

  IF _writes ? 'drop_settleds' THEN
    FOR v_drop_settled IN SELECT * FROM jsonb_array_elements_text(_writes->'drop_settleds')
    LOOP
      PERFORM write_drop_settled(v_drop_settled);
    END LOOP;
  END IF;

  IF _writes ? 'new_spots' THEN
    FOR v_new_spot IN SELECT * FROM jsonb_array_elements(_writes->'new_spots')
    LOOP
      SELECT write_spot(
        (v_new_spot->>'user_id')::UUID,
        v_new_spot->>'spot_name',
        COALESCE((v_new_spot->>'is_genesis_spot')::BOOLEAN, false),
        COALESCE((v_new_spot->>'genesis_yields_remaining')::INTEGER, 0)
      ) INTO v_spot_id;
      v_created_ids := jsonb_set(v_created_ids, '{spots}', v_created_ids->'spots' || jsonb_build_array(jsonb_build_object('id', v_spot_id, 'key', v_new_spot->>'key')));
    END LOOP;
  END IF;

  IF _writes ? 'new_drops' THEN
    FOR v_new_drop IN SELECT * FROM jsonb_array_elements(_writes->'new_drops')
    LOOP
      SELECT write_new_drop(
        (v_new_drop->>'spot_id')::UUID,
        (v_new_drop->>'position')::INTEGER
      ) INTO v_drop_id;
      v_created_ids := jsonb_set(v_created_ids, '{drops}', v_created_ids->'drops' || jsonb_build_array(jsonb_build_object('id', v_drop_id, 'key', v_new_drop->>'key')));
    END LOOP;
  END IF;

  IF _writes ? 'reentry_drops' THEN
    FOR v_reentry IN SELECT * FROM jsonb_array_elements(_writes->'reentry_drops')
    LOOP
      SELECT write_reentry_drop(
        (v_reentry->>'spot_id')::UUID,
        (v_reentry->>'position')::INTEGER
      ) INTO v_drop_id;
      v_created_ids := jsonb_set(v_created_ids, '{drops}', v_created_ids->'drops' || jsonb_build_array(v_drop_id));
    END LOOP;
  END IF;

  IF _writes ? 'notifications' THEN
    FOR v_notification IN SELECT * FROM jsonb_array_elements(_writes->'notifications')
    LOOP
      SELECT write_notification(
        (v_notification->>'user_id')::UUID,
        v_notification->>'type',
        v_notification->>'title',
        v_notification->>'message',
        COALESCE(v_notification->'metadata', '{}'),
        v_notification->>'link'
      ) INTO v_notif_id;
      v_created_ids := jsonb_set(v_created_ids, '{notifications}', v_created_ids->'notifications' || jsonb_build_array(v_notif_id));
    END LOOP;
  END IF;

  IF _writes ? 'profile_updates' THEN
    FOR v_profile_update IN SELECT * FROM jsonb_array_elements(_writes->'profile_updates')
    LOOP
      PERFORM write_profile_update(
        (v_profile_update->>'user_id')::UUID,
        COALESCE((v_profile_update->>'set_first_cycle_completed_at')::BOOLEAN, false),
        COALESCE((v_profile_update->>'set_last_payout_at')::BOOLEAN, false),
        COALESCE((v_profile_update->>'total_recycled_profit_add')::NUMERIC, 0),
        COALESCE((v_profile_update->>'set_genesis_completed_at')::BOOLEAN, false)
      );
    END LOOP;
  END IF;

  IF _writes ? 'spot_stats' THEN
    FOR v_spot_stat IN SELECT * FROM jsonb_array_elements(_writes->'spot_stats')
    LOOP
      PERFORM write_spot_stats(
        (v_spot_stat->>'spot_id')::UUID,
        (v_spot_stat->>'total_earnings_add')::NUMERIC,
        COALESCE((v_spot_stat->>'cycles_add')::INTEGER, 1),
        COALESCE((v_spot_stat->>'genesis_yields_remaining_subtract')::INTEGER, 0)
      );
    END LOOP;
  END IF;

  IF _writes ? 'genesis_completions' THEN
    FOR v_genesis IN SELECT * FROM jsonb_array_elements(_writes->'genesis_completions')
    LOOP
      SELECT process_genesis_completion(
        (v_genesis->>'user_id')::UUID,
        (v_genesis->>'genesis_spot_id')::UUID,
        v_genesis->>'user_name'
      ) INTO v_genesis_result;
      v_created_ids := jsonb_set(v_created_ids, '{genesis_results}', v_created_ids->'genesis_results' || jsonb_build_array(v_genesis_result));
    END LOOP;
  END IF;

  IF _writes ? 'auto_compound_triggers' THEN
    FOR v_compound IN SELECT * FROM jsonb_array_elements(_writes->'auto_compound_triggers')
    LOOP
      SELECT process_auto_compound(
        (v_compound->>'user_id')::UUID,
        v_compound->>'user_name'
      ) INTO v_compound_result;
      v_created_ids := jsonb_set(v_created_ids, '{compound_results}', v_created_ids->'compound_results' || jsonb_build_array(v_compound_result));
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'created_ids', v_created_ids);
EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

DROP FUNCTION IF EXISTS public.refresh_user_cache(uuid) CASCADE;