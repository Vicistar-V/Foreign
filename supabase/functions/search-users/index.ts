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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role
    const { data: hasAdminRole } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });

    if (!hasAdminRole) {
      return new Response(
        JSON.stringify({ success: false, error: 'Access denied. Admin role required.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { query } = await req.json();

    if (!query || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Search query is required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('search-users: Searching for:', query);

    // Search profiles by name or referral code (exclude system treasury)
    const searchPattern = `%${query}%`;
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, referral_code, is_member, created_at, avatar_url, birth_year, birth_month')
      .or(`full_name.ilike.${searchPattern},referral_code.ilike.${searchPattern}`)
      .limit(20);

    if (profilesError) {
      console.error('search-users: Profile search error:', profilesError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to search users' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enhance with additional data
    const enhancedUsers = await Promise.all(
      profiles.map(async (profile) => {
        // Get email from auth.users
        const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
        
        // Get earnings total
        const { data: earnings } = await supabase
          .from('transactions')
          .select('amount')
          .eq('user_id', profile.id)
          .eq('wallet_type', 'earnings')
          .eq('status', 'completed');
        
        const totalEarnings = earnings?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        // Get referral count
        const { count: referralCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .ilike('referred_by_code', profile.referral_code);

        return {
          id: profile.id,
          full_name: profile.full_name,
          email: authUser?.user?.email || 'N/A',
          referral_code: profile.referral_code,
          is_member: profile.is_member,
          created_at: profile.created_at,
          total_earnings: Math.round(totalEarnings),
          referral_count: referralCount || 0,
          avatar_url: profile.avatar_url || null,
        };
      })
    );

    console.log('search-users: Found', enhancedUsers.length, 'users');

    return new Response(
      JSON.stringify({ success: true, users: enhancedUsers }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('search-users: Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
