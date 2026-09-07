import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuditLogRequest {
  limit?: number;
  offset?: number;
  fromDate?: string;
  toDate?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ====================
    // STEP 1: VERIFY ADMIN
    // ====================
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('[get-flutterwave-audit-logs] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: roleData, error: roleError } = await supabaseClient
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (roleError || !roleData) {
      console.error('[get-flutterwave-audit-logs] Not admin:', roleError);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[get-flutterwave-audit-logs] Admin verified:', user.id);

    // ====================
    // STEP 2: PARSE REQUEST
    // ====================
    const body: AuditLogRequest = await req.json().catch(() => ({}));
    const limit = Math.min(body.limit || 20, 100);
    const offset = body.offset || 0;
    const fromDate = body.fromDate;
    const toDate = body.toDate;

    console.log('[get-flutterwave-audit-logs] Fetching logs with limit:', limit, 'offset:', offset);

    // ====================
    // STEP 3: FETCH AUDIT LOGS
    // ====================
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Flutterwave-related alert types
    const flutterwaveAlertTypes = [
      'admin_flutterwave_transfer',
      'admin_transfer_retry',
      'admin_transfer_status_check',
    ];

    let query = supabaseAdmin
      .from('system_alerts')
      .select('*', { count: 'exact' })
      .in('alert_type', flutterwaveAlertTypes)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Add date filters if provided
    if (fromDate) {
      query = query.gte('created_at', `${fromDate}T00:00:00`);
    }
    if (toDate) {
      query = query.lte('created_at', `${toDate}T23:59:59`);
    }

    const { data: logs, error: logsError, count } = await query;

    if (logsError) {
      console.error('[get-flutterwave-audit-logs] Error fetching logs:', logsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch audit logs' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[get-flutterwave-audit-logs] Found', logs?.length, 'logs out of', count, 'total');

    // ====================
    // STEP 4: ENRICH WITH ADMIN NAMES
    // ====================
    // Get unique admin IDs from logs
    const adminIds = [...new Set(
      (logs || [])
        .map((log: any) => log.metadata?.admin_id)
        .filter(Boolean)
    )];

    let adminMap: Record<string, string> = {};
    
    if (adminIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name')
        .in('id', adminIds);
      
      if (profiles) {
        adminMap = profiles.reduce((acc: Record<string, string>, p: any) => {
          acc[p.id] = p.full_name;
          return acc;
        }, {});
      }
    }

    // Enrich logs with admin names
    const enrichedLogs = (logs || []).map((log: any) => ({
      ...log,
      admin_name: log.metadata?.admin_id ? adminMap[log.metadata.admin_id] || 'Unknown Admin' : 'System',
    }));

    // ====================
    // STEP 5: RETURN RESPONSE
    // ====================
    return new Response(
      JSON.stringify({
        success: true,
        logs: enrichedLogs,
        total: count || 0,
        limit,
        offset,
        hasMore: (offset + limit) < (count || 0),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[get-flutterwave-audit-logs] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch audit logs', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
