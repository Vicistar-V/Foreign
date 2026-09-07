import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the user from the token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse query params
    const url = new URL(req.url);
    const logType = url.searchParams.get('type') || 'webhooks';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    const search = url.searchParams.get('search') || '';

    console.log('get-system-logs: Fetching logs', { logType, page, limit, search });

    let logs: Record<string, unknown>[] = [];
    let total = 0;

    if (logType === 'webhooks') {
      // Fetch webhook logs
      let query = supabase
        .from('webhook_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        query = query.or(`event_type.ilike.%${search}%,error_message.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      logs = data?.map(log => ({
        id: log.id,
        type: 'webhook',
        event_type: log.event_type,
        success: log.processed_successfully,
        error_message: log.error_message,
        created_at: log.created_at,
        data: log.event_data,
        signature: log.signature ? '****' + log.signature.slice(-8) : null
      })) || [];

      // Get count
      let countQuery = supabase
        .from('webhook_logs')
        .select('id', { count: 'exact', head: true });

      if (search) {
        countQuery = countQuery.or(`event_type.ilike.%${search}%,error_message.ilike.%${search}%`);
      }

      const { count } = await countQuery;
      total = count || 0;

    } else if (logType === 'alerts') {
      // Fetch system alerts
      let query = supabase
        .from('system_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        query = query.or(`message.ilike.%${search}%,alert_type.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      logs = data?.map(alert => ({
        id: alert.id,
        type: 'alert',
        alert_type: alert.alert_type,
        severity: alert.severity,
        message: alert.message,
        created_at: alert.created_at,
        acknowledged_at: alert.acknowledged_at,
        acknowledged_by: alert.acknowledged_by,
        data: alert.metadata
      })) || [];

      // Get count
      let countQuery = supabase
        .from('system_alerts')
        .select('id', { count: 'exact', head: true });

      if (search) {
        countQuery = countQuery.or(`message.ilike.%${search}%,alert_type.ilike.%${search}%`);
      }

      const { count } = await countQuery;
      total = count || 0;

    } else if (logType === 'deposits') {
      // Fetch deposit transactions for verification
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('transaction_type', 'deposit')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) throw error;

      // Get user profiles
      const userIds = [...new Set(data?.map(d => d.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      logs = data?.map(tx => ({
        id: tx.id,
        type: 'deposit',
        user_id: tx.user_id,
        user: profilesMap.get(tx.user_id) || { full_name: 'Unknown', avatar_url: null },
        amount: tx.amount,
        status: tx.status,
        payment_reference: tx.payment_reference,
        created_at: tx.created_at,
        data: tx.metadata
      })) || [];

      // Get count
      const { count } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('transaction_type', 'deposit');

      total = count || 0;
    }

    console.log('get-system-logs: Success', { returned: logs.length, total });

    return new Response(JSON.stringify({
      logs,
      pagination: {
        page,
        limit,
        total,
        hasMore: (offset + limit) < total
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('get-system-logs: Error', error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
