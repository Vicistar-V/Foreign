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
    const { 
      userId, 
      notifFilter = 'all', 
      notifPage = 1, 
      notifLimit = 10 
    } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'userId is required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('get-user-details: Fetching details for user:', userId);

    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Real PIN lives in user_pin_secrets (bcrypt). profiles.pin_hash is legacy.
    const { data: pinSecret } = await supabase
      .from('user_pin_secrets')
      .select('pin_hash')
      .eq('user_id', userId)
      .maybeSingle();
    const pinHasReal = !!(pinSecret?.pin_hash && pinSecret.pin_hash.startsWith('$2'));

    // Get auth user data
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);

    // Get cached balances
    const { data: balances } = await supabase
      .from('cached_balances')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Get recent transactions
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    // Get user's spots (spots)
    const { data: spots } = await supabase
      .from('spots')
      .select(`
        id,
        spot_name,
        status,
        total_cycles,
        total_earnings,
        created_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Get user's queue entries (drops)
    const { data: queueEntries } = await supabase
      .from('drops')
      .select(`
        id,
        position,
        fill_amount,
        target_amount,
        status,
        source_type,
        created_at,
        completed_at,
        paid_at,
        is_settled,
        spot_id
      `)
      .in('spot_id', (spots || []).map(m => m.id))
      .order('created_at', { ascending: false })
      .limit(30);

    // Get referrals
    const { data: referrals } = await supabase
      .from('profiles')
      .select('id, full_name, created_at, is_member, avatar_url')
      .ilike('referred_by_code', profile.referral_code);

    // Calculate referral earnings from transactions
    const { data: refEarningsData } = await supabase
      .from('transactions')
      .select('amount, metadata, created_at')
      .eq('user_id', userId)
      .in('transaction_type', ['referral_payout', 'referral_first_cycle_bonus', 'drop_referral_cycle'])
      .eq('wallet_type', 'earnings')
      .eq('status', 'completed');

    const totalReferralEarnings = (refEarningsData || []).reduce((sum, t) => sum + Number(t.amount), 0);

    const referralDetails = (referrals || []).map((ref) => {
      const bonusTx = (refEarningsData || []).find(
        (t: any) => t.metadata?.original_user_id === ref.id || t.metadata?.referee_id === ref.id
      );
      
      return {
        id: ref.id,
        name: ref.full_name,
        avatar_url: ref.avatar_url,
        date: ref.created_at,
        earned: bonusTx ? Number(bonusTx.amount) : 0,
        is_member: ref.is_member,
      };
    });

    // Financial Summary
    const { data: depositData } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('transaction_type', 'deposit')
      .eq('status', 'completed');
    
    const totalDeposited = (depositData || []).reduce((sum, t) => sum + Number(t.amount), 0);

    const { data: withdrawalData } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('transaction_type', 'withdrawal')
      .eq('status', 'completed');
    
    const totalWithdrawn = Math.abs((withdrawalData || []).reduce((sum, t) => sum + Number(t.amount), 0));

    const { data: pendingWithdrawalData } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('transaction_type', 'withdrawal')
      .eq('status', 'pending');
    
    const pendingWithdrawals = Math.abs((pendingWithdrawalData || []).reduce((sum, t) => sum + Number(t.amount), 0));

    // ==========================================
    // SPOT STATS (renamed from viketaStats/dropStats)
    // ==========================================
    const totalSpots = spots?.length || 0;
    const activeSpots = spots?.filter(m => m.status === 'active').length || 0;
    const totalCycles = spots?.reduce((sum, m) => sum + (m.total_cycles || 0), 0) || 0;
    const totalSpotEarnings = spots?.reduce((sum, m) => sum + Number(m.total_earnings || 0), 0) || 0;

    // Queue stats
    const spotsInQueue = queueEntries?.filter(d => ['waiting', 'filling'].includes(d.status)).length || 0;
    const paidOutCount = queueEntries?.filter(d => d.status === 'paid' || d.paid_at).length || 0;

    const spotStats = {
      total_spots: totalSpots,
      active_spots: activeSpots,
      total_cycles: totalCycles,
      total_earnings: totalSpotEarnings,
      spots_in_queue: spotsInQueue,
      paid_out_count: paidOutCount,
      auto_compound_enabled: profile.auto_compound_enabled || false,
    };

    // ==========================================
    // REFERRAL STATS (enhanced)
    // ==========================================
    const referralStats = {
      total_invited: referrals?.length || 0,
      active_referrals: referrals?.filter(r => r.is_member).length || 0,
      pending_referrals: referrals?.filter(r => !r.is_member).length || 0,
      total_earned: totalReferralEarnings,
    };

    // ==========================================
    // NEW: WITHDRAWAL ACCOUNTS (Bank Accounts)
    // ==========================================
    const { data: withdrawalAccounts } = await supabase
      .from('withdrawal_accounts')
      .select('id, bank_name, account_number, account_name, is_primary, is_verified, bank_code, created_at')
      .eq('user_id', userId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false });

    // ==========================================
    // SUPPORT TICKETS
    // ==========================================
    const { data: supportTickets, count: totalTickets } = await supabase
      .from('support_tickets')
      .select('id, subject, category, status, priority, created_at, updated_at, resolved_at', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get message counts for each ticket
    const ticketIds = (supportTickets || []).map(t => t.id);
    const { data: ticketMessageCounts } = ticketIds.length > 0
      ? await supabase
          .from('ticket_messages')
          .select('ticket_id')
          .in('ticket_id', ticketIds)
      : { data: [] };

    // Count messages per ticket
    const messageCountMap: Record<string, number> = {};
    (ticketMessageCounts || []).forEach(tm => {
      messageCountMap[tm.ticket_id] = (messageCountMap[tm.ticket_id] || 0) + 1;
    });

    const ticketsWithMessageCount = (supportTickets || []).map(ticket => ({
      ...ticket,
      message_count: messageCountMap[ticket.id] || 0,
    }));

    const ticketStats = {
      total: totalTickets || 0,
      open: supportTickets?.filter(t => t.status === 'open').length || 0,
      in_progress: supportTickets?.filter(t => t.status === 'in_progress').length || 0,
      resolved: supportTickets?.filter(t => ['resolved', 'closed'].includes(t.status)).length || 0,
    };

    // ==========================================
    // ACTIVITY & LOCATION
    // ==========================================
    const lastSeenAt = profile.last_seen_at;
    const lastSignInAt = authUser?.user?.last_sign_in_at || null;
    const lastActivity = lastSeenAt || lastSignInAt || profile.created_at;

    // Current location from activity log
    const { data: currentLocationData, error: currentLocationError } = await supabase
      .from('user_activity_log')
      .select('page_name, page_path, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (currentLocationError) {
      console.warn('get-user-details: Could not load current location:', currentLocationError.message);
    }

    // Recent journey
    const { data: recentJourneyData, error: recentJourneyError } = await supabase
      .from('user_activity_log')
      .select('page_name, page_path, action_type, action_detail, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (recentJourneyError) {
      console.warn('get-user-details: Could not load recent journey:', recentJourneyError.message);
    }

    const currentLocation = currentLocationData ? {
      page_name: currentLocationData.page_name,
      page_path: currentLocationData.page_path,
      last_seen_at: currentLocationData.created_at,
    } : null;

    const recentJourney = (recentJourneyData || []).map(activity => ({
      page_name: activity.page_name,
      page_path: activity.page_path,
      action_type: activity.action_type,
      action_detail: activity.action_detail,
      at: activity.created_at,
    }));

    // Referrer info
    let referredByUser = null;
    if (profile.referred_by_code) {
      const { data: referrerProfile } = await supabase
        .from('profiles')
        .select('id, full_name, referral_code, avatar_url')
        .ilike('referral_code', profile.referred_by_code)
        .single();
      
      if (referrerProfile) {
        referredByUser = {
          id: referrerProfile.id,
          name: referrerProfile.full_name,
          code: referrerProfile.referral_code,
          avatar_url: referrerProfile.avatar_url,
        };
      }
    }

    // ==========================================
    // NOTIFICATIONS (with pagination)
    // ==========================================
    const offset = (notifPage - 1) * notifLimit;

    // Get notifications
    const { data: allNotifs, count: totalNotifsCount } = await supabase
      .from('notifications')
      .select('id, notification_type, title, message, metadata, created_at, read_at, link', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Get relevant transactions for notifications
    const { data: allTx, count: totalTxCount } = await supabase
      .from('transactions')
      .select('id, transaction_type, amount, description, created_at, read_at, wallet_type', { count: 'exact' })
      .eq('user_id', userId)
      .in('transaction_type', ['deposit', 'withdrawal', 'drop_profit', 'referral_payout'])
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    // Combine and paginate
    const combined = [
      ...(allNotifs || []).map(n => ({ ...n, source: 'notification' as const })),
      ...(allTx || []).map(t => ({ ...t, source: 'transaction' as const })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const paginated = combined.slice(offset, offset + notifLimit);
    const filteredNotifs = paginated.filter(n => n.source === 'notification');
    const filteredTx = paginated.filter(n => n.source === 'transaction');

    // Unread counts
    const { count: unreadNotifsCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);

    const { count: unreadTxCount } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('transaction_type', ['deposit', 'withdrawal', 'drop_profit', 'referral_payout'])
      .eq('status', 'completed')
      .is('read_at', null);

    const notificationStats = {
      total_notifications: totalNotifsCount || 0,
      total_transactions: totalTxCount || 0,
      unread_notifications: unreadNotifsCount || 0,
      unread_transactions: unreadTxCount || 0,
      total_unread: (unreadNotifsCount || 0) + (unreadTxCount || 0),
      current_filter: notifFilter,
      current_page: notifPage,
      page_size: notifLimit,
      total_filtered: combined.length,
      total_pages: Math.ceil(combined.length / notifLimit),
    };

    // ==========================================
    // DAILY TASK (today + recent 14 days + pending balance)
    // ==========================================
    const lagosToday = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' })
    );
    const todayStr = `${lagosToday.getFullYear()}-${String(lagosToday.getMonth() + 1).padStart(2, '0')}-${String(lagosToday.getDate()).padStart(2, '0')}`;

    const { data: todayTask } = await supabase
      .from('daily_task')
      .select('*')
      .eq('user_id', userId)
      .eq('task_date', todayStr)
      .maybeSingle();

    const { data: recentTasks } = await supabase
      .from('daily_task')
      .select('task_date, batches_done, bonus_batches, metadata')
      .eq('user_id', userId)
      .order('task_date', { ascending: false })
      .limit(14);

    const { data: pendingRpc } = await supabase.rpc('get_pending_balance', { _user_id: userId });

    const dailyTask = {
      today: todayTask || null,
      recent: recentTasks || [],
      pending_balance: Number(pendingRpc ?? 0),
    };

    // ==========================================
    // BUILD RESPONSE
    // ==========================================
    const userDetails = {
      success: true,
      profile: {
        ...profile,
        email: authUser?.user?.email || 'N/A',
        has_pin: pinHasReal,
        last_sign_in_at: authUser?.user?.last_sign_in_at || null,
        email_confirmed_at: authUser?.user?.email_confirmed_at || null,
        auth_created_at: authUser?.user?.created_at || null,
      },
      balances: {
        earnings_balance: Number(balances?.earnings_balance ?? 0),
        deposit_balance: Number(balances?.deposit_balance ?? 0),
        pending_balance: Number(pendingRpc ?? balances?.pending_balance ?? 0),
      },
      financialSummary: {
        total_deposited: totalDeposited,
        total_withdrawn: totalWithdrawn,
        net_position: totalDeposited - totalWithdrawn,
        pending_withdrawals: pendingWithdrawals,
      },
      // RENAMED from viketaStats/dropStats to spotStats
      spotStats,
      referralStats,
      // NEW DATA
      withdrawalAccounts: withdrawalAccounts || [],
      supportTickets: ticketsWithMessageCount,
      ticketStats,
      // Activity
      lastActivity,
      currentLocation,
      recentJourney,
      referredByUser,
      // Existing data (renamed for clarity)
      recentTransactions: transactions || [],
      spots: spots || [],
      queueEntries: queueEntries || [],
      referrals: referralDetails,
      notifications: {
        items: filteredNotifs,
        transactions: filteredTx,
        stats: notificationStats,
      },
      dailyTask,
    };

    console.log('get-user-details: Success - spotStats:', spotStats);

    return new Response(
      JSON.stringify(userDetails),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('get-user-details: Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
