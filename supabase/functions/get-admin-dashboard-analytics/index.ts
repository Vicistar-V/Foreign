import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to get current Nigerian date/time
function getNigerianNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }))
}

// Helper to format date as YYYY-MM-DD
function formatDateYMD(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Helper to get N days ago from Nigerian now
function getNigerianDaysAgo(days: number): Date {
  const nigerianNow = getNigerianNow()
  nigerianNow.setDate(nigerianNow.getDate() - days)
  return nigerianNow
}

// Helper to parse YYYY-MM-DD string to Date
function parseNigerianDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // --- Auth gate: must be logged-in admin ---
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin',
    })
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }


    // Parse request body
    let timeRange: number | 'all' | 'custom' = 30
    let customStartDate: string | null = null
    let customEndDate: string | null = null
    
    try {
      const body = await req.json()
      if (body.timeRange) timeRange = body.timeRange
      if (body.customStartDate) customStartDate = body.customStartDate
      if (body.customEndDate) customEndDate = body.customEndDate
    } catch {
      // Default to 30 days
    }

    const nigerianNow = getNigerianNow()
    const today = formatDateYMD(nigerianNow)
    
    // Calculate period dates
    let periodStartDate: string
    let periodEndDate: string = today
    let actualDays: number
    
    if (timeRange === 'custom' && customStartDate && customEndDate) {
      periodStartDate = customStartDate
      periodEndDate = customEndDate
      const start = parseNigerianDate(customStartDate)
      const end = parseNigerianDate(customEndDate)
      actualDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    } else if (timeRange === 'all') {
      periodStartDate = formatDateYMD(getNigerianDaysAgo(365 * 10))
      actualDays = 90
    } else {
      const days = typeof timeRange === 'number' ? timeRange : 30
      periodStartDate = formatDateYMD(getNigerianDaysAgo(days))
      actualDays = days
    }

    const periodStartISO = `${periodStartDate}T00:00:00.000Z`
    const periodEndISO = `${periodEndDate}T23:59:59.999Z`

    console.log(`Viketa Line Admin Analytics - Date: ${today}, Range: ${timeRange}`)

    // =====================================================
    // PARALLEL QUERIES FOR VIKETA LINE SYSTEM
    // =====================================================

    const [
      // User counts
      totalUsersResult,
      totalMembersResult,
      newUsersPeriodResult,
      
      // Viketa Line: Spots & Drops
      totalSpotsResult,
      activeSpotsResult,
      totalDropsResult,
      dropsInQueueResult,
      
      // Queue status (uses database function)
      queueStatusResult,
      fillingDropsResult,
      
      // Pulse history
      recentPulsesResult,
      todayPulsesResult,
      
      // Financial data
      totalProfitDistributedResult,
      totalUserBalancesResult,
      
      // Pending actions
      pendingWithdrawalsResult,
      
      // Platform config
      configResult,
      
      // User signups trend
      userSignupsResult,
      
      // Membership activations trend
      membershipActivationsResult,
      
      // Spot purchases trend
      spotPurchasesResult,
      
      // Top referrers
      topReferrersResult,
      
      // Recent activity
      recentActivityResult,
      
      // Total cycles completed
      totalCyclesResult,
    ] = await Promise.all([
      // Total users
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      
      // Total members
      supabase.from('profiles').select('id', { count: 'exact', head: true })
        .eq('is_member', true),
      
      // New users in period
      supabase.from('profiles').select('id', { count: 'exact', head: true })
        .gte('created_at', periodStartISO)
        .lte('created_at', periodEndISO),
      
      // Total spots ever created
      supabase.from('spots').select('id', { count: 'exact', head: true }),
      
      // Active spots
      supabase.from('spots').select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
      
      // Total drops ever
      supabase.from('drops').select('id', { count: 'exact', head: true }),
      
      // Drops currently in queue (waiting or filling)
      supabase.from('drops').select('id', { count: 'exact', head: true })
        .in('status', ['waiting', 'filling']),
      
      // Queue status from database function
      supabase.rpc('get_drop_queue_status'),

      // Currently filling drops (for average fill percent)
      supabase.from('drops')
        .select('fill_amount, target_amount')
        .eq('status', 'filling'),
      
      // Recent pulses (last 10)
      supabase.from('drop_pulses')
        .select('*')
        .order('pulse_number', { ascending: false })
        .limit(10),
      
      // Today's pulses
      supabase.from('drop_pulses')
        .select('*')
        .gte('started_at', `${today}T00:00:00.000Z`),
      
      // Total profit distributed (drop_profit transactions)
      supabase.from('transactions')
        .select('amount')
        .eq('transaction_type', 'drop_profit')
        .eq('status', 'completed'),
      
      // Total user balances
      supabase.from('cached_balances')
        .select('earnings_balance, deposit_balance'),
      
      // Pending withdrawals
      supabase.from('transactions')
        .select('id, amount', { count: 'exact' })
        .eq('transaction_type', 'withdrawal')
        .eq('status', 'pending'),
      
      // Platform config
      supabase.from('platform_config').select('*').eq('id', 1).single(),
      
      // User signups in period
      supabase.from('profiles')
        .select('created_at')
        .gte('created_at', periodStartISO)
        .lte('created_at', periodEndISO)
        .order('created_at', { ascending: true }),
      
      // Membership activations in period
      supabase.from('transactions')
        .select('created_at')
        .eq('transaction_type', 'membership_fee')
        .eq('status', 'completed')
        .gte('created_at', periodStartISO)
        .lte('created_at', periodEndISO)
        .order('created_at', { ascending: true }),
      
      // Spot purchases in period (drop_entry transactions)
      supabase.from('transactions')
        .select('created_at')
        .eq('transaction_type', 'drop_entry')
        .eq('status', 'completed')
        .gte('created_at', periodStartISO)
        .lte('created_at', periodEndISO)
        .order('created_at', { ascending: true }),
      
      // Top referrers (include id for user_id)
      supabase.from('profiles')
        .select('id, referral_code, full_name, avatar_url')
        .not('referral_code', 'is', null),
      
      // Recent activity (last 20 transactions)
      supabase.from('transactions')
        .select('id, user_id, transaction_type, amount, created_at, wallet_type, status, description')
        .order('created_at', { ascending: false })
        .limit(20),
      
      // Total cycles completed (sum from spots)
      supabase.from('spots').select('total_cycles'),
    ])

    // =====================================================
    // PROCESS RESULTS
    // =====================================================

    const totalUsers = totalUsersResult.count || 0
    const totalMembers = totalMembersResult.count || 0
    const newUsersPeriod = newUsersPeriodResult.count || 0
    const totalSpots = totalSpotsResult.count || 0
    const activeSpots = activeSpotsResult.count || 0
    const totalDrops = totalDropsResult.count || 0
    const dropsInQueue = dropsInQueueResult.count || 0
    
    // Queue status from RPC
    const queueStatus = queueStatusResult.data || {}
    
    // Pulse stats
    const recentPulses = recentPulsesResult.data || []
    const todayPulses = todayPulsesResult.data || []
    const todayPayouts = todayPulses.reduce((sum, p) => sum + (p.payouts_made || 0), 0)
    const todayDistributed = todayPulses.reduce((sum, p) => sum + Number(p.total_distributed || 0), 0)
    
    // Total cycles
    const totalCycles = totalCyclesResult.data?.reduce((sum, s) => sum + (s.total_cycles || 0), 0) || 0
    
    // Financial
    const totalProfitDistributed = totalProfitDistributedResult.data?.reduce((sum, t) => sum + Number(t.amount), 0) || 0
    const totalUserBalances = totalUserBalancesResult.data?.reduce((sum, b) => {
      return sum + (Number(b.earnings_balance) || 0) + (Number(b.deposit_balance) || 0)
    }, 0) || 0

    // Average fill percent across currently-filling drops
    const fillingDrops = (fillingDropsResult.data as Array<{ fill_amount: number; target_amount: number }> | null) || []
    const averageFillPercent = fillingDrops.length > 0
      ? Math.round(
          fillingDrops.reduce((sum, d) => {
            const target = Number(d.target_amount) || 0
            const fill = Number(d.fill_amount) || 0
            return sum + (target > 0 ? (fill / target) * 100 : 0)
          }, 0) / fillingDrops.length
        )
      : 0

    // Estimated seconds to next payout: drops ahead of next payout × pulse interval
    const pulseIntervalSeconds = (configResult.data as { drop_pulse_interval_seconds?: number } | null)?.drop_pulse_interval_seconds || 60
    const estimatedPayoutSeconds = dropsInQueue > 0 ? pulseIntervalSeconds : 0
    
    const pendingWithdrawalsCount = pendingWithdrawalsResult.count || 0
    const pendingWithdrawalsAmount = pendingWithdrawalsResult.data?.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0) || 0
    
    const config = configResult.data

    // Process spot purchases by date
    const spotPurchasesByDate: Record<string, number> = {}
    spotPurchasesResult.data?.forEach((tx: { created_at: string }) => {
      const utcDate = new Date(tx.created_at)
      const nigerianDate = new Date(utcDate.toLocaleString('en-US', { timeZone: 'Africa/Lagos' }))
      const dateStr = formatDateYMD(nigerianDate)
      spotPurchasesByDate[dateStr] = (spotPurchasesByDate[dateStr] || 0) + 1
    })

    // Process user signups by date
    const signupsByDate: Record<string, number> = {}
    userSignupsResult.data?.forEach((user: { created_at: string }) => {
      const utcDate = new Date(user.created_at)
      const nigerianDate = new Date(utcDate.toLocaleString('en-US', { timeZone: 'Africa/Lagos' }))
      const dateStr = formatDateYMD(nigerianDate)
      signupsByDate[dateStr] = (signupsByDate[dateStr] || 0) + 1
    })
    
    // Process membership activations by date
    const activationsByDate: Record<string, number> = {}
    membershipActivationsResult.data?.forEach((tx: { created_at: string }) => {
      const utcDate = new Date(tx.created_at)
      const nigerianDate = new Date(utcDate.toLocaleString('en-US', { timeZone: 'Africa/Lagos' }))
      const dateStr = formatDateYMD(nigerianDate)
      activationsByDate[dateStr] = (activationsByDate[dateStr] || 0) + 1
    })

    // Build chart arrays
    const chartDays = timeRange === 'all' ? 90 : (typeof timeRange === 'number' ? timeRange : 30)
    
    const spotPurchasesTrend: Array<{ date: string; count: number }> = []
    const userGrowth: Array<{ date: string; signups: number; members: number }> = []
    
    if (timeRange === 'custom' && customStartDate && customEndDate) {
      const startDate = parseNigerianDate(customStartDate)
      const endDate = parseNigerianDate(customEndDate)
      const currentDate = new Date(startDate)
      
      while (currentDate <= endDate) {
        const dateStr = formatDateYMD(currentDate)
        spotPurchasesTrend.push({
          date: dateStr,
          count: spotPurchasesByDate[dateStr] || 0
        })
        userGrowth.push({
          date: dateStr,
          signups: signupsByDate[dateStr] || 0,
          members: activationsByDate[dateStr] || 0
        })
        currentDate.setDate(currentDate.getDate() + 1)
      }
    } else {
      for (let i = chartDays - 1; i >= 0; i--) {
        const date = getNigerianDaysAgo(i)
        const dateStr = formatDateYMD(date)
        spotPurchasesTrend.push({
          date: dateStr,
          count: spotPurchasesByDate[dateStr] || 0
        })
        userGrowth.push({
          date: dateStr,
          signups: signupsByDate[dateStr] || 0,
          members: activationsByDate[dateStr] || 0
        })
      }
    }

    // Process top referrers - now with user_id
    const referralCounts: Record<string, { user_id: string, name: string, avatar: string | null, count: number }> = {}
    
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('referred_by_code')
      .not('referred_by_code', 'is', null)
    
    allProfiles?.forEach(profile => {
      if (profile.referred_by_code) {
        if (!referralCounts[profile.referred_by_code]) {
          referralCounts[profile.referred_by_code] = { user_id: '', name: '', avatar: null, count: 0 }
        }
        referralCounts[profile.referred_by_code].count++
      }
    })
    
    // Get user_id from profiles for referrers
    topReferrersResult.data?.forEach(user => {
      if (referralCounts[user.referral_code]) {
        referralCounts[user.referral_code].user_id = (user as any).id || ''
        referralCounts[user.referral_code].name = user.full_name
        referralCounts[user.referral_code].avatar = user.avatar_url
      }
    })
    
    const topReferrers = Object.entries(referralCounts)
      .map(([code, data]) => ({ code, user_id: data.user_id, name: data.name, avatar: data.avatar, count: data.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Get top cyclers (most cycles) - now with user_id
    const { data: topCyclers } = await supabase
      .from('spots')
      .select('user_id, total_cycles, total_earnings')
      .order('total_cycles', { ascending: false })
      .limit(5)
    
    let topCyclersWithNames: Array<{ user_id: string; name: string; avatar: string | null; cycles: number; earnings: number }> = []
    if (topCyclers && topCyclers.length > 0) {
      const userIds = topCyclers.map(s => s.user_id)
      const { data: cyclerProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds)
      
      const profileMap = new Map(cyclerProfiles?.map(p => [p.id, p]) || [])
      
      topCyclersWithNames = topCyclers.map(s => ({
        user_id: s.user_id,
        name: profileMap.get(s.user_id)?.full_name || 'Unknown',
        avatar: profileMap.get(s.user_id)?.avatar_url || null,
        cycles: s.total_cycles,
        earnings: Number(s.total_earnings)
      }))
    }

    // Process recent activity - include user_id
    const userIds = [...new Set(recentActivityResult.data?.map(t => t.user_id) || [])]
    const { data: activityUsers } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds)
    
    const userMap = new Map(activityUsers?.map(u => [u.id, u]) || [])
    
    const recentActivity = recentActivityResult.data?.map(tx => {
      const userProfile = userMap.get(tx.user_id)
      return {
        id: tx.id,
        type: tx.transaction_type,
        amount: Number(tx.amount),
        description: tx.description,
        timestamp: tx.created_at,
        status: tx.status,
        user: { 
          user_id: tx.user_id,
          full_name: userProfile?.full_name || 'Unknown', 
          avatar_url: userProfile?.avatar_url || null 
        }
      }
    }) || []

    // Generate insights
    const insights: string[] = []
    
    if (newUsersPeriod > 0) {
      let periodLabel = 'total'
      if (timeRange === 'custom') {
        periodLabel = `in selected range`
      } else if (timeRange !== 'all' && typeof timeRange === 'number') {
        periodLabel = timeRange === 1 ? 'today' : `in last ${timeRange} days`
      }
      insights.push(`${newUsersPeriod} new users ${periodLabel}`)
    }
    
    if (todayPayouts > 0) {
      insights.push(`${todayPayouts} payouts today (₦${todayDistributed.toLocaleString()})`)
    }
    
    if (dropsInQueue > 0) {
      insights.push(`${dropsInQueue} drops waiting in The Line`)
    }
    
    if (pendingWithdrawalsCount > 0) {
      insights.push(`${pendingWithdrawalsCount} pending withdrawals (₦${pendingWithdrawalsAmount.toLocaleString()})`)
    }
    
    if (recentPulses.length > 0 && recentPulses[0]) {
      const lastPulse = recentPulses[0]
      const timeSince = Math.round((Date.now() - new Date(lastPulse.started_at).getTime()) / 1000)
      if (timeSince < 120) {
        insights.push(`Last pulse: ${timeSince}s ago`)
      } else {
        insights.push(`Last pulse: ${Math.round(timeSince / 60)}m ago`)
      }
    }

    // =====================================================
    // RETURN VIKETA LINE ANALYTICS
    // =====================================================

    const analytics = {
      // Overview stats
      overview: {
        totalUsers,
        totalMembers,
        activeSpots,
        dropsInQueue,
        totalCycles,
        totalProfitDistributed,
        totalUserBalances,
        pendingWithdrawals: pendingWithdrawalsCount,
        pendingWithdrawalsAmount,
      },
      
      // Platform status
      status: {
        dropSystemActive: config?.drop_system_active ?? true,
        distributionActive: config?.distribution_active ?? true,
        maintenanceMode: config?.maintenance_mode ?? false,
        withdrawalsEnabled: config?.withdrawals_enabled ?? true,
        lastPulseTime: recentPulses[0]?.started_at || null,
        pulseIntervalSeconds: config?.drop_pulse_interval_seconds || 60,
      },
      
      // Queue details
      queue: {
        totalInQueue: dropsInQueue,
        nextPayoutPosition: queueStatus.next_position || 0,
        averageFillPercent,
        estimatedPayoutTime: estimatedPayoutSeconds,
        totalSpots,
        totalDrops,
      },
      
      // Charts data
      charts: {
        spotPurchases: spotPurchasesTrend,
        userGrowth,
      },
      
      // Pulse history
      pulseHistory: recentPulses.map(p => ({
        pulseNumber: p.pulse_number,
        timestamp: p.started_at,
        newDrops: p.new_drops_processed || 0,
        reEntries: p.re_entries_processed || 0,
        payouts: p.payouts_made || 0,
        distributed: Number(p.total_distributed) || 0,
        status: p.status,
      })),
      
      // Today's pulse stats
      todayStats: {
        totalPulses: todayPulses.length,
        totalPayouts: todayPayouts,
        totalDistributed: todayDistributed,
      },
      
      // Top performers
      topPerformers: {
        referrers: topReferrers,
        cyclers: topCyclersWithNames,
      },
      
      // Recent activity
      recentActivity,
      
      // Quick insights
      insights,
      
      // Config info
      config: {
        entryFee: config?.drop_entry_fee || 5000,
        targetAmount: config?.drop_target_amount || 2000,
        profitAmount: config?.drop_profit_amount || 900,
        adminFee: config?.drop_admin_fee || 100,
      },
      
      // Meta
      generatedAt: new Date().toISOString(),
      nigerianDate: today,
      timeRange,
    }

    console.log(`Viketa Line Admin Analytics generated for ${today}`)

    return new Response(JSON.stringify(analytics), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in get-admin-dashboard-analytics:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
