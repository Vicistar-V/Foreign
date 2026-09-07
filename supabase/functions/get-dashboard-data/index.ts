import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key for backend operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Extract JWT token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated', errorCode: 'UNAUTHORIZED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated', errorCode: 'UNAUTHORIZED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch only browser-safe profile fields. Keep private fields such as PIN hashes server-only.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, is_member, is_banned, banned_reason, referral_code, auto_compound_enabled, created_at, birth_year, birth_month')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch profile', errorCode: 'SERVER_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch user's active spots and drops (The Viketa Line)
    const { data: spots, error: spotsError } = await supabase
      .from('spots')
      .select(`
        id,
        spot_name,
        status,
        total_cycles,
        total_earnings,
        created_at,
        drops!inner(
          id,
          position,
          fill_amount,
          target_amount,
          status,
          source_type,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .in('drops.status', ['waiting', 'filling'])
      .order('created_at', { ascending: true });

    if (spotsError) {
      console.error('Spots error:', spotsError);
    }

    // Get global queue stats
    const { data: queueStats, error: queueError } = await supabase
      .rpc('get_drop_queue_status');

    if (queueError) {
      console.error('Queue stats error:', queueError);
    }

    // Fetch platform config
    const { data: config, error: configError } = await supabase
      .from('platform_config')
      .select('*')
      .eq('id', 1)
      .single();

    if (configError) {
      console.error('Config error:', configError);
    }

    // Count referrals
    const { count: referralCount, error: referralError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .ilike('referred_by_code', profile.referral_code);

    if (referralError) {
      console.error('Referral count error:', referralError);
    }

    // Calculate total earned from earnings wallet
    const { data: earningsTransactions, error: earningsError } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', user.id)
      .eq('wallet_type', 'earnings')
      .gt('amount', 0);

    const totalEarned = earningsTransactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    // Total staked = membership (bundles first spot) + (extra spots × extension cost)
    const activeSpotCount = spots?.length || 0;
    const membershipFee = Number(config?.membership_fee || 5000);
    const extraSpotCost = Number(config?.drop_entry_fee || 5000);
    const totalStaked = profile.is_member
      ? membershipFee + Math.max(0, activeSpotCount - 1) * extraSpotCost
      : 0;

    // Legacy member detection: is_member = true BUT no spots (old Viketa users)
    const isLegacyMember = profile.is_member === true && activeSpotCount === 0;

    // Pending balance (derived, UTC day) + today's daily task summary
    const { data: pendingRpc } = await supabase.rpc('get_pending_balance', { _user_id: user.id });
    const pendingBalance = Number(pendingRpc ?? 0);

    let dailyTask: any = null;
    try {
      const { data: dt } = await supabase.rpc('get_daily_task', { _user_id: user.id });
      if (dt && (dt as any).success) dailyTask = dt;
    } catch (e) {
      console.error('daily task fetch failed', e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        profile,
        spots: spots || [],
        queueStats: queueStats || null,
        config,
        stats: {
          referralCount: referralCount || 0,
          totalEarned,
          activeSpotCount,
          totalStaked,
          pendingBalance,
        },
        dailyTask,
        isLegacyMember,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', errorCode: 'SERVER_ERROR' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
