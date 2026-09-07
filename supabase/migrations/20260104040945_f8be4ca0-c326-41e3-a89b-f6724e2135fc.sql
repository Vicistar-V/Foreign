-- Refund all pending v1 drop entries so users can use v2 instant play
-- This processes refunds back to the original wallet sources

DO $$
DECLARE
  v_entry RECORD;
  v_breakdown JSONB;
  v_refund_count INTEGER := 0;
BEGIN
  -- Process each pending entry for REAL users only (not ghost entries)
  FOR v_entry IN 
    SELECT 
      de.id,
      de.user_id,
      de.total_amount,
      de.metadata->'payment_breakdown' as payment_breakdown,
      de.drop_date
    FROM drop_entries de
    JOIN profiles p ON p.id = de.user_id
    WHERE de.result_status = 'pending'
      AND de.user_id NOT IN (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
        '44444444-4444-4444-4444-444444444444'::uuid
      )
  LOOP
    v_breakdown := v_entry.payment_breakdown;
    
    -- Refund to credits wallet if paid with credits
    IF (v_breakdown->>'credits')::DECIMAL > 0 THEN
      INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
      VALUES (
        v_entry.user_id, 
        'credits', 
        (v_breakdown->>'credits')::DECIMAL, 
        'drop_refund',
        'V2 Upgrade Refund - Your v1 drop entry returned', 
        'completed',
        jsonb_build_object('v2_upgrade_refund', true, 'original_entry_id', v_entry.id, 'drop_date', v_entry.drop_date)
      );
    END IF;
    
    -- Refund to deposit wallet if paid with deposit
    IF (v_breakdown->>'deposit')::DECIMAL > 0 THEN
      INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
      VALUES (
        v_entry.user_id, 
        'deposit', 
        (v_breakdown->>'deposit')::DECIMAL, 
        'drop_refund',
        'V2 Upgrade Refund - Your v1 drop entry returned', 
        'completed',
        jsonb_build_object('v2_upgrade_refund', true, 'original_entry_id', v_entry.id, 'drop_date', v_entry.drop_date)
      );
    END IF;
    
    -- Refund to earnings wallet if paid with earnings
    IF (v_breakdown->>'earnings')::DECIMAL > 0 THEN
      INSERT INTO transactions (user_id, wallet_type, amount, transaction_type, description, status, metadata)
      VALUES (
        v_entry.user_id, 
        'earnings', 
        (v_breakdown->>'earnings')::DECIMAL, 
        'drop_refund',
        'V2 Upgrade Refund - Your v1 drop entry returned', 
        'completed',
        jsonb_build_object('v2_upgrade_refund', true, 'original_entry_id', v_entry.id, 'drop_date', v_entry.drop_date)
      );
    END IF;
    
    -- Mark entry as refunded (using protected status since it's a refund)
    UPDATE drop_entries 
    SET result_status = 'protected',
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('v2_upgrade_refund', true, 'refunded_at', now())
    WHERE id = v_entry.id;
    
    v_refund_count := v_refund_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Refunded % pending v1 drop entries for V2 upgrade', v_refund_count;
END $$;

-- Also mark the ghost entries as refunded (no actual money to return)
UPDATE drop_entries 
SET result_status = 'protected',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('v2_upgrade_refund', true, 'ghost_entry_closed', true, 'refunded_at', now())
WHERE result_status = 'pending'
  AND user_id IN (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    '44444444-4444-4444-4444-444444444444'::uuid
  );