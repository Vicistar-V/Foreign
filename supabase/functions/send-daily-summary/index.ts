import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get current Nigerian date in YYYY-MM-DD format
function getNigerianDate(): string {
  const now = new Date();
  const lagosTime = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
  const year = lagosTime.getFullYear();
  const month = String(lagosTime.getMonth() + 1).padStart(2, '0');
  const day = String(lagosTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get start and end of Nigerian day in UTC for querying
function getNigerianDayBounds(dateStr: string): { startUtc: string; endUtc: string } {
  // Lagos is UTC+1
  // Start of day in Lagos: 00:00 WAT = 23:00 UTC previous day
  // End of day in Lagos: 23:59:59 WAT = 22:59:59 UTC same day
  
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // Start: midnight Lagos time = 23:00 UTC previous day
  const startDate = new Date(Date.UTC(year, month - 1, day - 1, 23, 0, 0));
  
  // End: 23:59:59 Lagos time = 22:59:59 UTC same day
  const endDate = new Date(Date.UTC(year, month - 1, day, 22, 59, 59, 999));
  
  return {
    startUtc: startDate.toISOString(),
    endUtc: endDate.toISOString()
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📊 send-daily-summary: Starting daily summary collection');
    
    const todayNigerian = getNigerianDate();
    const { startUtc, endUtc } = getNigerianDayBounds(todayNigerian);
    
    console.log(`📅 Summary for: ${todayNigerian}`);
    console.log(`🕐 UTC range: ${startUtc} to ${endUtc}`);
    
    // =====================================================
    // QUERY 1: New Signups (profiles created today)
    // =====================================================
    const { count: newSignups, error: signupError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startUtc)
      .lte('created_at', endUtc);
    
    if (signupError) {
      console.error('❌ Error fetching signups:', signupError);
    }
    console.log(`👤 New signups: ${newSignups || 0}`);
    
    // =====================================================
    // QUERY 2: New Members (membership_fee transactions today)
    // =====================================================
    const { count: newMembers, error: memberError } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('transaction_type', 'membership_fee')
      .eq('status', 'completed')
      .gte('created_at', startUtc)
      .lte('created_at', endUtc);
    
    if (memberError) {
      console.error('❌ Error fetching members:', memberError);
    }
    console.log(`✅ New members: ${newMembers || 0}`);
    
    // =====================================================
    // QUERY 3: Drop Entries Today
    // =====================================================
    const { count: totalEntries, error: entryError } = await supabase
      .from('drop_entries')
      .select('*', { count: 'exact', head: true })
      .eq('drop_date', todayNigerian);
    
    if (entryError) {
      console.error('❌ Error fetching entries:', entryError);
    }
    console.log(`🎯 Drop entries: ${totalEntries || 0}`);
    
    // =====================================================
    // QUERY 4: Completed Withdrawals Today
    // =====================================================
    const { count: completedWithdrawals, error: completedWdError } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('transaction_type', 'withdrawal')
      .eq('status', 'completed')
      .gte('created_at', startUtc)
      .lte('created_at', endUtc);
    
    if (completedWdError) {
      console.error('❌ Error fetching completed withdrawals:', completedWdError);
    }
    console.log(`💸 Completed withdrawals: ${completedWithdrawals || 0}`);
    
    // =====================================================
    // QUERY 5: Pending Withdrawals (all time, not just today)
    // =====================================================
    const { count: pendingWithdrawals, error: pendingWdError } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('transaction_type', 'withdrawal')
      .eq('status', 'pending');
    
    if (pendingWdError) {
      console.error('❌ Error fetching pending withdrawals:', pendingWdError);
    }
    console.log(`⏳ Pending withdrawals: ${pendingWithdrawals || 0}`);
    
    // =====================================================
    // QUERY 6: New Support Tickets Today
    // =====================================================
    const { count: newTickets, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startUtc)
      .lte('created_at', endUtc);
    
    if (ticketError) {
      console.error('❌ Error fetching tickets:', ticketError);
    }
    console.log(`🆘 New tickets: ${newTickets || 0}`);
    
    // =====================================================
    // QUERY 7: Total Deposits Today (Money In)
    // =====================================================
    const { data: depositData, error: depositError } = await supabase
      .from('transactions')
      .select('amount')
      .eq('transaction_type', 'deposit')
      .eq('status', 'completed')
      .gte('created_at', startUtc)
      .lte('created_at', endUtc);
    
    if (depositError) {
      console.error('❌ Error fetching deposits:', depositError);
    }
    const totalDeposits = depositData?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    console.log(`💰 Total deposits: ₦${totalDeposits}`);
    
    // =====================================================
    // QUERY 8: Total Withdrawals Today (Money Out)
    // Note: withdrawal amounts are stored as negative
    // =====================================================
    const { data: withdrawalData, error: withdrawalError } = await supabase
      .from('transactions')
      .select('amount')
      .eq('transaction_type', 'withdrawal')
      .eq('status', 'completed')
      .gte('created_at', startUtc)
      .lte('created_at', endUtc);
    
    if (withdrawalError) {
      console.error('❌ Error fetching withdrawal amounts:', withdrawalError);
    }
    // Withdrawal amounts are negative, so we negate to get positive value
    const totalWithdrawals = Math.abs(withdrawalData?.reduce((sum, t) => sum + Number(t.amount), 0) || 0);
    console.log(`💸 Total withdrawals: ₦${totalWithdrawals}`);
    
    // =====================================================
    // SEND TELEGRAM ALERT
    // =====================================================
    console.log('📤 Sending daily summary to Telegram...');
    
    const telegramPayload = {
      alertType: 'daily_summary',
      summaryDate: todayNigerian,
      newSignups: newSignups || 0,
      newMembers: newMembers || 0,
      totalEntries: totalEntries || 0,
      completedWithdrawals: completedWithdrawals || 0,
      pendingWithdrawals: pendingWithdrawals || 0,
      newTickets: newTickets || 0,
      totalDeposits: totalDeposits,
      totalWithdrawals: totalWithdrawals
    };
    
    const telegramResponse = await supabase.functions.invoke('send-telegram-alert', {
      body: telegramPayload
    });
    
    if (telegramResponse.error) {
      console.error('❌ Failed to send Telegram alert:', telegramResponse.error);
    } else {
      console.log('✅ Daily summary sent to Telegram');
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        date: todayNigerian,
        stats: {
          newSignups: newSignups || 0,
          newMembers: newMembers || 0,
          totalEntries: totalEntries || 0,
          completedWithdrawals: completedWithdrawals || 0,
          pendingWithdrawals: pendingWithdrawals || 0,
          newTickets: newTickets || 0,
          totalDeposits,
          totalWithdrawals,
          netFlow: totalDeposits - totalWithdrawals
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('💥 send-daily-summary error:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
