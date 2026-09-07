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
    const status = url.searchParams.get('status') || 'all';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    console.log('get-pending-withdrawals: Fetching withdrawals', { status, page, limit });

    // Build query for withdrawals
    let query = supabase
      .from('transactions')
      .select(`
        id,
        user_id,
        amount,
        status,
        payment_reference,
        description,
        metadata,
        created_at
      `)
      .eq('transaction_type', 'withdrawal')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== 'all') {
      query = query.eq('status', status);
    } else {
      // Show pending and failed by default
      query = query.in('status', ['pending', 'failed']);
    }

    const { data: withdrawals, error: withdrawalsError } = await query;

    if (withdrawalsError) {
      console.error('get-pending-withdrawals: Error fetching withdrawals', withdrawalsError);
      throw withdrawalsError;
    }

    // Get user profiles and bank accounts for the withdrawals
    const userIds = [...new Set(withdrawals?.map(w => w.user_id) || [])];
    
    const [profilesResult, accountsResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds),
      supabase
        .from('withdrawal_accounts')
        .select('user_id, bank_name, account_number, account_name')
        .in('user_id', userIds)
        .eq('is_primary', true)
    ]);

    const profilesMap = new Map(profilesResult.data?.map(p => [p.id, p]) || []);
    const accountsMap = new Map(accountsResult.data?.map(a => [a.user_id, a]) || []);

    // Combine data
    const enrichedWithdrawals = withdrawals?.map(w => ({
      ...w,
      user: profilesMap.get(w.user_id) || { full_name: 'Unknown User', avatar_url: null },
      bank_account: accountsMap.get(w.user_id) || null,
      fee: w.metadata?.withdrawal_fee || 50,
      transfer_amount: w.metadata?.transfer_amount || (Math.abs(w.amount) - 50),
      flutterwave_id: w.metadata?.flutterwave_id || null,
      failure_reason: w.metadata?.failure_reason || null
    })) || [];

    // Get count for pagination
    let countQuery = supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('transaction_type', 'withdrawal');

    if (status !== 'all') {
      countQuery = countQuery.eq('status', status);
    } else {
      countQuery = countQuery.in('status', ['pending', 'failed']);
    }

    const { count } = await countQuery;

    console.log('get-pending-withdrawals: Success', { 
      returned: enrichedWithdrawals.length, 
      total: count 
    });

    return new Response(JSON.stringify({
      withdrawals: enrichedWithdrawals,
      pagination: {
        page,
        limit,
        total: count || 0,
        hasMore: (offset + limit) < (count || 0)
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('get-pending-withdrawals: Error', error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
