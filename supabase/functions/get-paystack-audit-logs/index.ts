// get-paystack-audit-logs — mirror of get-flutterwave-audit-logs but
// filters system_alerts rows whose alert_type starts with 'admin_paystack_'.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: roleData } = await supabaseClient.rpc('has_role', {
      _user_id: user.id, _role: 'admin'
    });
    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(body.limit || 20, 100);
    const offset = body.offset || 0;
    const fromDate = body.fromDate;
    const toDate = body.toDate;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const paystackAlertTypes = [
      'admin_paystack_transfer',
      'admin_paystack_status_check',
    ];

    let query = supabaseAdmin
      .from('system_alerts')
      .select('*', { count: 'exact' })
      .in('alert_type', paystackAlertTypes)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (fromDate) query = query.gte('created_at', `${fromDate}T00:00:00`);
    if (toDate) query = query.lte('created_at', `${toDate}T23:59:59`);

    const { data: logs, error: logsError, count } = await query;

    if (logsError) {
      console.error('[get-paystack-audit-logs] error:', logsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch audit logs' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminIds = [...new Set((logs || []).map((l: any) => l.metadata?.admin_id).filter(Boolean))];
    let adminMap: Record<string, string> = {};
    if (adminIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles').select('id, full_name').in('id', adminIds);
      if (profiles) {
        adminMap = profiles.reduce((acc: any, p: any) => { acc[p.id] = p.full_name; return acc; }, {});
      }
    }

    const enriched = (logs || []).map((log: any) => ({
      ...log,
      admin_name: log.metadata?.admin_id ? (adminMap[log.metadata.admin_id] || 'Unknown Admin') : 'System',
    }));

    return new Response(JSON.stringify({
      success: true,
      logs: enriched,
      total: count || 0,
      limit,
      offset,
      hasMore: (offset + limit) < (count || 0),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[get-paystack-audit-logs] error:', msg);
    return new Response(JSON.stringify({ error: 'Failed to fetch audit logs', details: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
