-- ==========================================
-- GENERIC EXECUTOR PATTERN
-- Edge Function has COMPLETE FREEDOM
-- No whitelisting - full control from Edge Function
-- ==========================================

-- ==========================================
-- EXECUTE_WRITE_BATCH: Generic command executor
-- Receives JSON commands and executes them
-- Edge Function defines EVERYTHING
-- ==========================================
CREATE OR REPLACE FUNCTION public.execute_write_batch(_commands JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cmd JSONB;
  v_table TEXT;
  v_op TEXT;
  v_data JSONB;
  v_set JSONB;
  v_where JSONB;
  v_id UUID;
  v_results JSONB := '[]'::JSONB;
  v_sql TEXT;
  v_columns TEXT;
  v_values TEXT;
  v_set_clause TEXT;
  v_key TEXT;
  v_value JSONB;
BEGIN
  -- Process each command
  FOR v_cmd IN SELECT * FROM jsonb_array_elements(_commands)
  LOOP
    v_table := v_cmd->>'table';
    v_op := v_cmd->>'op';
    v_data := v_cmd->'data';
    v_set := v_cmd->'set';
    v_where := v_cmd->'where';
    
    CASE v_op
      -- ==========================================
      -- INSERT: Dynamic insert with full flexibility
      -- ==========================================
      WHEN 'insert' THEN
        -- Build column list and values list from data keys
        SELECT 
          string_agg(quote_ident(key), ', '),
          string_agg(
            CASE jsonb_typeof(value)
              WHEN 'null' THEN 'NULL'
              WHEN 'boolean' THEN value::TEXT
              WHEN 'number' THEN value::TEXT
              WHEN 'string' THEN quote_literal(value #>> '{}')
              ELSE quote_literal(value::TEXT)
            END,
            ', '
          )
        INTO v_columns, v_values
        FROM jsonb_each(v_data);
        
        -- Check if table has an 'id' column that returns UUID
        v_sql := format(
          'INSERT INTO %I (%s) VALUES (%s) RETURNING id',
          v_table, v_columns, v_values
        );
        
        BEGIN
          EXECUTE v_sql INTO v_id;
          v_results := v_results || jsonb_build_object(
            'op', 'insert',
            'table', v_table,
            'id', v_id,
            'success', true
          );
        EXCEPTION WHEN undefined_column THEN
          -- Table doesn't have 'id' column, just execute without returning
          v_sql := format(
            'INSERT INTO %I (%s) VALUES (%s)',
            v_table, v_columns, v_values
          );
          EXECUTE v_sql;
          v_results := v_results || jsonb_build_object(
            'op', 'insert',
            'table', v_table,
            'success', true
          );
        END;
        
      -- ==========================================
      -- UPDATE: Dynamic update with any columns
      -- ==========================================
      WHEN 'update' THEN
        -- Build SET clause from 'set' object
        SELECT string_agg(
          quote_ident(key) || ' = ' || 
          CASE jsonb_typeof(value)
            WHEN 'null' THEN 'NULL'
            WHEN 'boolean' THEN value::TEXT
            WHEN 'number' THEN value::TEXT
            WHEN 'string' THEN quote_literal(value #>> '{}')
            ELSE quote_literal(value::TEXT)
          END,
          ', '
        )
        INTO v_set_clause
        FROM jsonb_each(v_set);
        
        -- Build WHERE clause from 'where' object
        -- For now, support simple key-value equality
        v_sql := format('UPDATE %I SET %s WHERE ', v_table, v_set_clause);
        
        SELECT v_sql || string_agg(
          quote_ident(key) || ' = ' ||
          CASE jsonb_typeof(value)
            WHEN 'null' THEN 'NULL'
            WHEN 'boolean' THEN value::TEXT
            WHEN 'number' THEN value::TEXT
            WHEN 'string' THEN quote_literal(value #>> '{}')
            ELSE quote_literal(value::TEXT)
          END,
          ' AND '
        )
        INTO v_sql
        FROM jsonb_each(v_where);
        
        EXECUTE v_sql;
        
        v_results := v_results || jsonb_build_object(
          'op', 'update',
          'table', v_table,
          'where', v_where,
          'success', true
        );
        
      -- ==========================================
      -- DELETE: Dynamic delete by conditions
      -- ==========================================
      WHEN 'delete' THEN
        v_sql := format('DELETE FROM %I WHERE ', v_table);
        
        SELECT v_sql || string_agg(
          quote_ident(key) || ' = ' ||
          CASE jsonb_typeof(value)
            WHEN 'null' THEN 'NULL'
            WHEN 'boolean' THEN value::TEXT
            WHEN 'number' THEN value::TEXT
            WHEN 'string' THEN quote_literal(value #>> '{}')
            ELSE quote_literal(value::TEXT)
          END,
          ' AND '
        )
        INTO v_sql
        FROM jsonb_each(v_where);
        
        EXECUTE v_sql;
        
        v_results := v_results || jsonb_build_object(
          'op', 'delete',
          'table', v_table,
          'where', v_where,
          'success', true
        );
        
      -- ==========================================  
      -- RPC: Call any stored function
      -- ==========================================
      WHEN 'rpc' THEN
        DECLARE
          v_func TEXT := v_cmd->>'function';
          v_args JSONB := COALESCE(v_cmd->'args', '{}');
          v_rpc_result JSONB;
          v_arg_list TEXT;
        BEGIN
          -- Build argument list for function call
          SELECT string_agg(
            quote_ident(key) || ' := ' ||
            CASE jsonb_typeof(value)
              WHEN 'null' THEN 'NULL'
              WHEN 'boolean' THEN value::TEXT
              WHEN 'number' THEN value::TEXT
              WHEN 'string' THEN quote_literal(value #>> '{}')
              ELSE quote_literal(value::TEXT)
            END,
            ', '
          )
          INTO v_arg_list
          FROM jsonb_each(v_args);
          
          -- Execute RPC with named arguments
          IF v_arg_list IS NOT NULL AND v_arg_list != '' THEN
            v_sql := format('SELECT %I(%s)', v_func, v_arg_list);
          ELSE
            v_sql := format('SELECT %I()', v_func);
          END IF;
          
          BEGIN
            EXECUTE v_sql INTO v_rpc_result;
            v_results := v_results || jsonb_build_object(
              'op', 'rpc',
              'function', v_func,
              'result', v_rpc_result,
              'success', true
            );
          EXCEPTION WHEN OTHERS THEN
            -- RPC might return non-JSON, just mark success
            v_results := v_results || jsonb_build_object(
              'op', 'rpc',
              'function', v_func,
              'success', true
            );
          END;
        END;
        
      ELSE
        RAISE EXCEPTION 'Unknown operation: %', v_op;
    END CASE;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'commands_executed', jsonb_array_length(_commands),
    'results', v_results
  );

EXCEPTION WHEN OTHERS THEN
  -- Log the error and re-raise for transaction rollback
  RAISE;
END;
$$;

-- ==========================================
-- UPDATE: get_distribution_data to include spot count
-- Edge Function needs this for machine numbering
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_distribution_data(
  _origin_drop_id UUID,
  _max_drops INTEGER DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_config JSONB;
  v_drops JSONB;
  v_max_position INTEGER;
BEGIN
  -- Get platform config
  SELECT jsonb_build_object(
    'drop_entry_fee', drop_entry_fee,
    'drop_target_amount', drop_target_amount,
    'drop_profit_amount', drop_profit_amount,
    'drop_profit_amount_subsequent', drop_profit_amount_subsequent,
    'drop_admin_fee', drop_admin_fee,
    'drop_referral_per_cycle', drop_referral_per_cycle,
    'drop_reentry_amount', drop_reentry_amount,
    'drop_system_active', drop_system_active,
    'velocity_tier_enabled', velocity_tier_enabled,
    'velocity_tier_referral_requirement', velocity_tier_referral_requirement,
    'velocity_tier_cooldown_hours', velocity_tier_cooldown_hours
  ) INTO v_config
  FROM platform_config WHERE id = 1;
  
  -- Get unfilled drops with ALL related data
  SELECT COALESCE(jsonb_agg(row_to_json(d)::jsonb), '[]')
  INTO v_drops
  FROM (
    SELECT 
      d.id as drop_id,
      d.fill_amount,
      d.target_amount,
      d.position,
      d.status,
      s.id as spot_id,
      s.user_id as owner_id,
      s.spot_name,
      s.is_genesis_spot,
      s.genesis_yields_remaining,
      p.full_name as owner_name,
      p.auto_compound_enabled,
      p.referred_by_code,
      p.referral_code,
      p.first_cycle_completed_at,
      p.last_payout_at,
      p.total_recycled_profit,
      -- Count active referrals for velocity tier
      (
        SELECT COUNT(*) 
        FROM profiles ref 
        WHERE ref.referred_by_code = p.referral_code 
          AND ref.is_member = true
      ) as active_referrals_count,
      -- Get referrer ID if exists
      (
        SELECT id 
        FROM profiles 
        WHERE referral_code = p.referred_by_code
        LIMIT 1
      ) as referrer_id,
      -- Current balances for genesis/auto-compound
      COALESCE(cb.deposit_balance, 0) as deposit_balance,
      COALESCE(cb.earnings_balance, 0) as earnings_balance,
      -- Spot count for machine numbering
      (SELECT COUNT(*) FROM spots WHERE user_id = s.user_id) as user_spot_count
    FROM drops d
    JOIN spots s ON s.id = d.spot_id
    JOIN profiles p ON p.id = s.user_id
    LEFT JOIN cached_balances cb ON cb.user_id = s.user_id
    WHERE d.id != _origin_drop_id
      AND d.status IN ('waiting', 'filling')
      AND d.fill_amount < d.target_amount
    ORDER BY d.position ASC
    LIMIT _max_drops
  ) d;
  
  -- Get current max position for reentries
  SELECT COALESCE(MAX(position), 0) INTO v_max_position FROM drops;
  
  RETURN jsonb_build_object(
    'config', v_config,
    'drops', v_drops,
    'current_max_position', v_max_position
  );
END;
$$;

-- Add documentation
COMMENT ON FUNCTION public.execute_write_batch IS 'Generic batch executor - Edge Function has COMPLETE FREEDOM to write to any table, update any row, delete anything, or call any RPC. No whitelisting. All logic lives in Edge Function.';
