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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Not authorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const {
      page = 1,
      limit = 25,
      search = '',
      membership_status = 'all',
      banned_status = 'all',
      activity_status = 'all',
      email_status = 'all',
      has_spots = 'all',
      has_drops = 'all',
      phone_status = 'all',
      tour_status = 'all',
      sort_by = 'created_at',
      sort_order = 'desc',
      export_mode = false
    } = body;

    // Frontend sends has_drops; legacy callers send has_spots. Treat both.
    const hasSpotsFilter = has_drops !== 'all' ? has_drops : has_spots;

    console.log(`[get-all-users] Fetching users - page: ${page}, search: "${search}", has_spots: ${has_spots}`);

    // Activity status helper
    const getActivityStatus = (lastSeenAt: string | null): 'active' | 'idle' | 'dormant' | 'never' => {
      if (!lastSeenAt) return 'never';
      
      const lastSeen = new Date(lastSeenAt);
      const now = new Date();
      const minutesAgo = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
      
      if (minutesAgo <= 5) return 'active';
      if (minutesAgo <= 60) return 'idle';
      return 'dormant';
    };

    // Check if post-fetch filters are needed
    const needsPostFetchFiltering =
      activity_status !== 'all' ||
      email_status !== 'all' ||
      hasSpotsFilter !== 'all' ||
      tour_status !== 'all';

    // Build query
    let query = supabase
      .from('profiles')
      .select('id, full_name, referral_code, referred_by_code, is_member, is_banned, banned_reason, avatar_url, created_at, phone_number, is_name_locked, last_seen_at, birth_year, birth_month, activated_at', { count: 'exact' });

    // Apply filters
    if (membership_status === 'member') {
      query = query.eq('is_member', true);
    } else if (membership_status === 'not_member') {
      query = query.eq('is_member', false);
    }

    if (banned_status === 'banned') {
      query = query.eq('is_banned', true);
    } else if (banned_status === 'not_banned') {
      query = query.eq('is_banned', false);
    }

    if (search && search.trim()) {
      query = query.or(`full_name.ilike.%${search}%,referral_code.ilike.%${search}%,phone_number.ilike.%${search}%`);
    }

    if (phone_status === 'has_phone') {
      query = query.not('phone_number', 'is', null);
    } else if (phone_status === 'no_phone') {
      query = query.is('phone_number', null);
    }

    // Apply sorting
    if (sort_by === 'name') {
      query = query.order('full_name', { ascending: sort_order === 'asc' });
    } else if (sort_by === 'created_at') {
      query = query.order('created_at', { ascending: sort_order === 'asc' });
    } else if (sort_by === 'last_active') {
      query = query.order('last_seen_at', { ascending: sort_order === 'asc', nullsFirst: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    // Apply pagination if no post-fetch filters
    if (!needsPostFetchFiltering && !export_mode) {
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
    }

    const { data: profiles, error: profilesError, count: dbCount } = await query;

    if (profilesError) {
      console.error('[get-all-users] Error:', profilesError);
      throw profilesError;
    }

    // Export mode
    if (export_mode) {
      const phoneNumbers = (profiles || [])
        .filter(p => p.phone_number)
        .map(p => p.phone_number);
      
      return new Response(
        JSON.stringify({
          success: true,
          phone_numbers: phoneNumbers,
          total: phoneNumbers.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build a single map of referrer codes -> { full_name } to avoid N+1
    const referrerCodes = Array.from(new Set((profiles || [])
      .map(p => (p as any).referred_by_code)
      .filter((c): c is string => !!c && c !== 'SYSTEM')));
    let referrerMap = new Map<string, { full_name: string | null; id: string }>();
    if (referrerCodes.length > 0) {
      const { data: referrers } = await supabase
        .from('profiles')
        .select('id, full_name, referral_code')
        .in('referral_code', referrerCodes);
      (referrers || []).forEach(r => {
        if (r.referral_code) referrerMap.set(r.referral_code, { full_name: r.full_name, id: r.id });
      });
    }

    // Enrich users with Viketa Line data
    const enrichedUsers = await Promise.all((profiles || []).map(async (profile) => {
      const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);

      const { data: balanceData } = await supabase
        .from('cached_balances')
        .select('earnings_balance, deposit_balance, pending_balance')
        .eq('user_id', profile.id)
        .single();

      const { count: referralCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .ilike('referred_by_code', profile.referral_code);

      // Get Viketa Line stats (spots instead of drop_entries)
      const { data: spots } = await supabase
        .from('spots')
        .select('id, total_cycles, total_earnings, status')
        .eq('user_id', profile.id);

      const totalSpots = spots?.length || 0;
      const activeSpots = spots?.filter(s => s.status === 'active').length || 0;
      const totalCycles = spots?.reduce((sum, s) => sum + (s.total_cycles || 0), 0) || 0;
      const totalDropEarnings = spots?.reduce((sum, s) => sum + Number(s.total_earnings || 0), 0) || 0;

      // Get current location
      const { data: lastActivity, error: lastActivityError } = await supabase
        .from('user_activity_log')
        .select('page_name, page_path, created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastActivityError) {
        console.warn('[get-all-users] Could not load current location:', lastActivityError.message);
      }

      // Tour progress (may be null if user never opened the tour)
      const { data: tourRow } = await supabase
        .from('user_tour_progress')
        .select('current_step, is_completed')
        .eq('user_id', profile.id)
        .maybeSingle();

      const tourStatus: 'never_started' | 'in_progress' | 'completed' = !tourRow
        ? 'never_started'
        : tourRow.is_completed
          ? 'completed'
          : 'in_progress';

      const lastSeenAt = profile.last_seen_at;
      const lastSignInAt = authUser?.user?.last_sign_in_at || null;
      const emailConfirmed = !!authUser?.user?.email_confirmed_at;
      const userActivityStatus = getActivityStatus(lastSeenAt);

      return {
        id: profile.id,
        full_name: profile.full_name,
        email: authUser?.user?.email || 'Unknown',
        referral_code: profile.referral_code,
        referred_by_code: (profile as any).referred_by_code || null,
        referrer_name: (profile as any).referred_by_code
          ? (referrerMap.get((profile as any).referred_by_code)?.full_name || null)
          : null,
        referrer_id: (profile as any).referred_by_code
          ? (referrerMap.get((profile as any).referred_by_code)?.id || null)
          : null,
        birth_year: (profile as any).birth_year || null,
        birth_month: (profile as any).birth_month || null,
        activated_at: (profile as any).activated_at || null,
        is_member: profile.is_member,
        is_banned: profile.is_banned,
        banned_reason: profile.banned_reason,
        avatar_url: profile.avatar_url,
        created_at: profile.created_at,
        total_earnings: balanceData?.earnings_balance || 0,
        referral_count: referralCount || 0,
        balances: balanceData || { earnings_balance: 0, deposit_balance: 0, pending_balance: 0 },
        phone_number: profile.phone_number,
        is_name_locked: profile.is_name_locked,
        last_sign_in_at: lastSignInAt,
        last_activity_at: lastSeenAt,
        email_confirmed: emailConfirmed,
        // Viketa Line stats
        total_spots: totalSpots,
        active_spots: activeSpots,
        total_cycles: totalCycles,
        total_drop_earnings: totalDropEarnings,
        current_location: lastActivity ? {
          page_name: lastActivity.page_name,
          page_path: lastActivity.page_path,
          last_seen_at: lastActivity.created_at,
        } : null,
        tour_status: tourStatus,
        tour_step: tourRow?.current_step || null,
        _activity_status: userActivityStatus,
        _has_spots: totalSpots > 0,
      };
    }));

    // Apply post-fetch filters
    let filteredUsers = enrichedUsers;

    if (activity_status !== 'all') {
      filteredUsers = filteredUsers.filter(u => u._activity_status === activity_status);
    }

    if (email_status === 'verified') {
      filteredUsers = filteredUsers.filter(u => u.email_confirmed);
    } else if (email_status === 'unverified') {
      filteredUsers = filteredUsers.filter(u => !u.email_confirmed);
    }

    if (hasSpotsFilter === 'yes') {
      filteredUsers = filteredUsers.filter(u => u._has_spots);
    } else if (hasSpotsFilter === 'no') {
      filteredUsers = filteredUsers.filter(u => !u._has_spots);
    }

    if (tour_status !== 'all') {
      filteredUsers = filteredUsers.filter(u => u.tour_status === tour_status);
    }

    // Post-process sorting
    let sortedUsers = filteredUsers;
    if (sort_by === 'earnings') {
      sortedUsers = filteredUsers.sort((a, b) => 
        sort_order === 'asc' 
          ? a.total_earnings - b.total_earnings 
          : b.total_earnings - a.total_earnings
      );
    } else if (sort_by === 'referrals') {
      sortedUsers = filteredUsers.sort((a, b) => 
        sort_order === 'asc' 
          ? a.referral_count - b.referral_count 
          : b.referral_count - a.referral_count
      );
    } else if (sort_by === 'spots') {
      sortedUsers = filteredUsers.sort((a, b) => 
        sort_order === 'asc' 
          ? a.total_spots - b.total_spots 
          : b.total_spots - a.total_spots
      );
    }

    const totalAfterFilters = sortedUsers.length;

    // Apply pagination if post-fetch filters were used
    let paginatedUsers = sortedUsers;
    if (needsPostFetchFiltering) {
      const offset = (page - 1) * limit;
      paginatedUsers = sortedUsers.slice(offset, offset + limit);
    }

    // Remove internal fields
    const cleanedUsers = paginatedUsers.map(({ _activity_status, _has_spots, ...user }) => user);

    // Get platform stats
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    const { count: activeMembers } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_member', true);

    const { count: bannedUsers } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_banned', true);

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: onlineNowCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('last_seen_at', fiveMinutesAgo);

    const finalTotal = needsPostFetchFiltering ? totalAfterFilters : (dbCount || 0);

    console.log(`[get-all-users] Returning ${cleanedUsers.length} users`);

    return new Response(
      JSON.stringify({
        success: true,
        users: cleanedUsers,
        pagination: {
          page,
          limit,
          total: finalTotal,
          total_pages: Math.ceil(finalTotal / limit)
        },
        stats: {
          total_users: totalUsers || 0,
          active_members: activeMembers || 0,
          banned_users: bannedUsers || 0,
          online_now: onlineNowCount || 0
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[get-all-users] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
