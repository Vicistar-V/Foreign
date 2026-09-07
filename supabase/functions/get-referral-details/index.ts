import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Invalid token');
    }

    console.log('[get-referral-details] Fetching data for user:', user.id);

    // Get user's referral code
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    const referralCode = profile.referral_code;

    // Get all referred users
    const { data: referredUsers, error: referredError } = await supabase
      .from('profiles')
      .select('id, full_name, is_member, created_at')
      .ilike('referred_by_code', referralCode)
      .order('created_at', { ascending: false });

    if (referredError) {
      throw referredError;
    }

    // Get total earnings from FIRST CYCLE bonuses (₦500 one-time)
    const { data: firstCycleBonuses, error: firstCycleError } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', user.id)
      .eq('transaction_type', 'referral_first_cycle_bonus')
      .eq('wallet_type', 'earnings')
      .eq('status', 'completed');

    if (firstCycleError) {
      console.error('[get-referral-details] Error fetching first cycle bonuses:', firstCycleError);
    }

    const totalFirstCycleBonuses = (firstCycleBonuses || []).reduce((sum, t) => sum + Number(t.amount), 0);

    // Get legacy membership bonuses (old system)
    const { data: legacyBonuses, error: legacyError } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', user.id)
      .eq('transaction_type', 'membership_bonus')
      .eq('wallet_type', 'earnings')
      .not('metadata->referral_code', 'is', null)
      .eq('status', 'completed');

    if (legacyError) {
      console.error('[get-referral-details] Error fetching legacy bonuses:', legacyError);
    }

    const totalLegacyBonuses = (legacyBonuses || []).reduce((sum, t) => sum + Number(t.amount), 0);
    const totalEarned = totalFirstCycleBonuses + totalLegacyBonuses;

    // Get referral royalties from cycle completions (₦20 per subsequent cycle)
    const { data: royaltyTransactions, error: royaltyError } = await supabase
      .from('transactions')
      .select('amount, created_at, metadata')
      .eq('user_id', user.id)
      .eq('transaction_type', 'drop_referral_cycle')
      .eq('wallet_type', 'earnings')
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (royaltyError) {
      console.error('[get-referral-details] Error fetching royalties:', royaltyError);
    }

    const royalties = royaltyTransactions || [];
    const totalRoyalties = royalties.reduce((sum, t) => sum + Number(t.amount), 0);
    const royaltyCount = royalties.length;

    // Get recent royalties for display (last 10)
    const recentRoyalties = royalties.slice(0, 10).map(r => ({
      amount: Number(r.amount),
      createdAt: r.created_at,
      refereeName: (r.metadata as Record<string, unknown>)?.referee_name as string || 'Friend',
    }));

    // Pending bonus system removed - referral bonus is now paid instantly on activation.

    // Calculate stats - active = has completed at least one cycle
    const totalReferrals = referredUsers.length;
    
    // Get users who have active spots
    const referredUserIds = referredUsers.map(u => u.id);
    let activeMembers = 0;
    
    if (referredUserIds.length > 0) {
      const { data: spotsData } = await supabase
        .from('spots')
        .select('user_id')
        .in('user_id', referredUserIds)
        .eq('status', 'active');
      
      const usersWithSpots = new Set(spotsData?.map(s => s.user_id) || []);
      activeMembers = usersWithSpots.size;
    }
    
    const pendingMembers = totalReferrals - activeMembers;

    // Build detailed referral list
    const referrals = await Promise.all(
      referredUsers.map(async (refUser) => {
        const firstName = refUser.full_name?.split(' ')[0] || 'Friend';
        
        // Get user's email from auth.users
        const { data: authUser } = await supabase.auth.admin.getUserById(refUser.id);
        const email = authUser?.user?.email || '';

        // Get first cycle bonus (new system)
        const { data: firstCycleTx } = await supabase
          .from('transactions')
          .select('created_at, amount')
          .eq('user_id', user.id)
          .eq('transaction_type', 'referral_first_cycle_bonus')
          .filter('metadata->>referee_id', 'eq', refUser.id)
          .eq('status', 'completed')
          .maybeSingle();

        // Get legacy activation bonus (old system)
        const { data: legacyTx } = await supabase
          .from('transactions')
          .select('created_at, amount')
          .eq('user_id', user.id)
          .eq('transaction_type', 'membership_bonus')
          .eq('wallet_type', 'earnings')
          .filter('metadata->>original_user_id', 'eq', refUser.id)
          .eq('status', 'completed')
          .maybeSingle();

        const activationTx = firstCycleTx || legacyTx;

        return {
          id: refUser.id,
          firstName,
          email,
          joinedDate: refUser.created_at,
          activatedDate: activationTx?.created_at || null,
          // firstCycleCompletedAt removed
          isMember: refUser.is_member,
          bonusEarned: activationTx ? Number(activationTx.amount) : 0,
        };
      })
    );

    const result = {
      success: true,
      stats: {
        totalReferrals,
        activeMembers,
        totalEarned: totalEarned + totalRoyalties, // Include royalties in total
        pendingMembers
      },
      royalties: {
        totalRoyalties,
        royaltyCount,
        recentRoyalties,
      },
      firstCycleBonuses: {
        total: totalFirstCycleBonuses,
        count: (firstCycleBonuses || []).length
      },
      referrals,
      referralCode
    };

    console.log('[get-referral-details] Success:', result.stats, 'Royalties:', totalRoyalties);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[get-referral-details] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, errorCode: 'VALIDATION_ERROR' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
