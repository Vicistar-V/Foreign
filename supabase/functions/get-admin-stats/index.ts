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

    console.log('get-admin-stats: Fetching Viketa Line statistics');

    // Get total members
    const { count: totalMembers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Get active spots count
    const { count: activeSpots } = await supabase
      .from('spots')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Get drops in queue
    const { count: dropsInQueue } = await supabase
      .from('drops')
      .select('*', { count: 'exact', head: true })
      .in('status', ['waiting', 'filling']);

    // Get total profit distributed
    const { data: profitTransactions } = await supabase
      .from('transactions')
      .select('amount')
      .eq('transaction_type', 'drop_profit')
      .eq('status', 'completed');

    const totalDistributed = profitTransactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    // Get platform config
    const { data: config } = await supabase
      .from('platform_config')
      .select('drop_system_active, maintenance_mode, withdrawals_enabled, telegram_alerts_enabled, distribution_active')
      .eq('id', 1)
      .single();

    // Get recent pulse activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: recentPulses } = await supabase
      .from('drop_pulses')
      .select('started_at, payouts_made, total_distributed')
      .gte('started_at', sevenDaysAgo.toISOString())
      .order('started_at', { ascending: true });

    // Group by date for activity chart
    const activityMap = new Map<string, number>();
    recentPulses?.forEach(pulse => {
      const date = pulse.started_at.split('T')[0];
      const count = activityMap.get(date) || 0;
      activityMap.set(date, count + (pulse.payouts_made || 0));
    });

    const recentActivity = Array.from(activityMap.entries()).map(([date, count]) => ({
      date,
      count,
      type: 'payout',
    }));

    const stats = {
      success: true,
      totalMembers: totalMembers || 0,
      activeSpots: activeSpots || 0,
      dropsInQueue: dropsInQueue || 0,
      totalDistributed: Math.round(totalDistributed),
      dropSystemActive: config?.drop_system_active ?? true,
      distributionActive: config?.distribution_active ?? true,
      maintenanceMode: config?.maintenance_mode || false,
      withdrawalsEnabled: config?.withdrawals_enabled ?? true,
      telegramAlertsEnabled: config?.telegram_alerts_enabled ?? true,
      recentActivity,
    };

    console.log('get-admin-stats: Success', stats);

    return new Response(
      JSON.stringify(stats),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('get-admin-stats: Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
