import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Friendly category groups → underlying transaction_type values
const CATEGORY_TYPES: Record<string, string[]> = {
  drops: ['drop_entry', 'drop_profit', 'drop_reentry'],
  referrals: ['referral_payout', 'drop_referral_cycle', 'referral_first_cycle_bonus'],
  money: ['deposit', 'withdrawal'],
  membership: ['membership_fee', 'membership_bonus', 'welcome_bonus'],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed', errorCode: 'METHOD_NOT_ALLOWED' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header', errorCode: 'UNAUTHORIZED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized', errorCode: 'UNAUTHORIZED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse params (GET query OR POST body)
    let walletType: string | null = null;
    let category: string | null = null;
    let direction: string | null = null; // 'in' | 'out' | null
    let status: string | null = null;
    let sort: string = 'date_desc'; // date_desc | date_asc | amount_desc | amount_asc
    let limit = 15;
    let offset = 0;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      walletType = url.searchParams.get('wallet_type');
      category = url.searchParams.get('category');
      direction = url.searchParams.get('direction');
      status = url.searchParams.get('status');
      sort = url.searchParams.get('sort') || 'date_desc';
      limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '15')));
      offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0'));
    } else {
      const body = await req.json().catch(() => ({}));
      walletType = body.wallet_type ?? null;
      category = body.category ?? null;
      direction = body.direction ?? null;
      status = body.status ?? null;
      sort = body.sort || 'date_desc';
      limit = Math.min(50, Math.max(1, parseInt(body.limit || '15')));
      offset = Math.max(0, parseInt(body.offset || '0'));
    }

    // Helper to apply shared filters to a query builder
    const applyFilters = (q: any) => {
      q = q.eq('user_id', user.id);
      if (walletType && ['earnings', 'deposit'].includes(walletType)) {
        q = q.eq('wallet_type', walletType);
      }
      if (category && CATEGORY_TYPES[category]) {
        q = q.in('transaction_type', CATEGORY_TYPES[category]);
      }
      if (status && ['completed', 'pending', 'failed', 'reversed'].includes(status)) {
        q = q.eq('status', status);
      }
      if (direction === 'in') q = q.gt('amount', 0);
      else if (direction === 'out') q = q.lt('amount', 0);
      return q;
    };

    // Sort mapping
    const sortMap: Record<string, { col: string; asc: boolean }> = {
      date_desc: { col: 'created_at', asc: false },
      date_asc: { col: 'created_at', asc: true },
      amount_desc: { col: 'amount', asc: false },
      amount_asc: { col: 'amount', asc: true },
    };
    const { col: sortCol, asc: sortAsc } = sortMap[sort] || sortMap.date_desc;

    // Main page query
    let pageQuery = supabase.from('transactions').select('*', { count: 'exact' });
    pageQuery = applyFilters(pageQuery)
      .order(sortCol, { ascending: sortAsc })
      .range(offset, offset + limit - 1);

    // Stats queries (run in parallel) — counts only, fast
    const totalAllQ = supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const inCountQ = supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gt('amount', 0);

    const outCountQ = supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .lt('amount', 0);

    const pendingCountQ = supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'pending');

    const [pageRes, totalAllRes, inRes, outRes, pendingRes] = await Promise.all([
      pageQuery,
      totalAllQ,
      inCountQ,
      outCountQ,
      pendingCountQ,
    ]);

    if (pageRes.error) {
      console.error('[get-transactions] page error:', pageRes.error);
      throw pageRes.error;
    }

    const filteredTotal = pageRes.count || 0;
    const hasMore = offset + limit < filteredTotal;

    return new Response(
      JSON.stringify({
        success: true,
        transactions: pageRes.data || [],
        total: filteredTotal,           // total matching CURRENT filter
        hasMore,
        limit,
        offset,
        stats: {
          all: totalAllRes.count || 0,         // all-time count (no filter)
          money_in: inRes.count || 0,
          money_out: outRes.count || 0,
          pending: pendingRes.count || 0,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[get-transactions] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error', errorCode: 'SERVER_ERROR' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
