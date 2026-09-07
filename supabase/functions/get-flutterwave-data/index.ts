import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3';

interface FlutterwaveBalance {
  currency: string;
  available_balance: number;
  ledger_balance: number;
}

interface FlutterwaveTransfer {
  id: number;
  account_number: string;
  bank_name: string;
  full_name: string;
  amount: number;
  currency: string;
  reference: string;
  status: string;
  complete_message: string;
  created_at: string;
  fee: number;
  meta?: Record<string, unknown>;
}

interface FlutterwaveTransaction {
  id: number;
  tx_ref: string;
  flw_ref: string;
  device_fingerprint: string;
  amount: number;
  currency: string;
  charged_amount: number;
  app_fee: number;
  merchant_fee: number;
  processor_response: string;
  auth_model: string;
  ip: string;
  narration: string;
  status: string;
  payment_type: string;
  created_at: string;
  customer: {
    id: number;
    name: string;
    phone_number: string;
    email: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('[get-flutterwave-data] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: roleData, error: roleError } = await supabaseClient
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (roleError || !roleData) {
      console.error('[get-flutterwave-data] Not admin:', roleError);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body for date filters
    let fromDate: string | null = null;
    let toDate: string | null = null;
    
    try {
      const body = await req.json();
      fromDate = body.fromDate || null;
      toDate = body.toDate || null;
      console.log('[get-flutterwave-data] Date filters - From:', fromDate, 'To:', toDate);
    } catch {
      // No body or invalid JSON - use defaults
      console.log('[get-flutterwave-data] No date filters provided, using defaults');
    }

    const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
    if (!flutterwaveSecretKey) {
      console.error('[get-flutterwave-data] Missing FLUTTERWAVE_SECRET_KEY');
      return new Response(
        JSON.stringify({ error: 'Flutterwave not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const headers = {
      'Authorization': `Bearer ${flutterwaveSecretKey}`,
      'Content-Type': 'application/json',
    };

    console.log('[get-flutterwave-data] Fetching data from Flutterwave...');

    // Build URL with date parameters
    const buildUrl = (baseEndpoint: string) => {
      const params = new URLSearchParams();
      params.append('page', '1');
      params.append('page_size', '100');
      
      if (fromDate) {
        params.append('from', fromDate);
      }
      if (toDate) {
        params.append('to', toDate);
      }
      
      return `${FLUTTERWAVE_BASE_URL}${baseEndpoint}?${params.toString()}`;
    };

    const transfersUrl = buildUrl('/transfers');
    const transactionsUrl = buildUrl('/transactions');
    
    console.log('[get-flutterwave-data] Transfers URL:', transfersUrl);
    console.log('[get-flutterwave-data] Transactions URL:', transactionsUrl);

    // Fetch all data in parallel for efficiency
    const [balancesRes, transfersRes, transactionsRes] = await Promise.all([
      // 1. Fetch wallet balances (no date filter needed)
      fetch(`${FLUTTERWAVE_BASE_URL}/balances`, { headers }),
      
      // 2. Fetch transfers with date range
      fetch(transfersUrl, { headers }),
      
      // 3. Fetch transactions with date range
      fetch(transactionsUrl, { headers }),
    ]);

    // Parse responses
    const balancesData = await balancesRes.json();
    const transfersData = await transfersRes.json();
    const transactionsData = await transactionsRes.json();

    console.log('[get-flutterwave-data] Balances response:', JSON.stringify(balancesData).substring(0, 200));
    console.log('[get-flutterwave-data] Transfers response status:', transfersData.status, 'Count:', transfersData.data?.length || 0);
    console.log('[get-flutterwave-data] Transactions response status:', transactionsData.status, 'Count:', transactionsData.data?.length || 0);

    // Process balances - FILTER TO NGN ONLY
    const allBalances: FlutterwaveBalance[] = balancesData.status === 'success' 
      ? balancesData.data.map((b: Record<string, unknown>) => ({
          currency: b.currency,
          available_balance: Number(b.available_balance) || 0,
          ledger_balance: Number(b.ledger_balance) || 0,
        }))
      : [];
    
    // Only return NGN balance
    const ngnBalance = allBalances.filter(b => b.currency === 'NGN');
    console.log('[get-flutterwave-data] NGN Balance found:', ngnBalance.length > 0 ? 'Yes' : 'No');

    // Process transfers and categorize by status (CASE-INSENSITIVE)
    const allTransfers: FlutterwaveTransfer[] = transfersData.status === 'success' 
      ? (transfersData.data || [])
      : [];

    // Use lowercase comparison to handle mixed case from Flutterwave API
    const pendingTransfers = allTransfers.filter(t => {
      const statusLower = (t.status || '').toLowerCase();
      return statusLower === 'pending' || statusLower === 'new' || statusLower === 'queued';
    });
    const successfulTransfers = allTransfers.filter(t => 
      (t.status || '').toLowerCase() === 'successful'
    );
    const failedTransfers = allTransfers.filter(t => 
      (t.status || '').toLowerCase() === 'failed'
    );

    console.log('[get-flutterwave-data] Transfer status breakdown - Pending:', pendingTransfers.length, 
      'Successful:', successfulTransfers.length, 'Failed:', failedTransfers.length);

    // Process transactions
    const allTransactions: FlutterwaveTransaction[] = transactionsData.status === 'success'
      ? (transactionsData.data || [])
      : [];

    console.log('[get-flutterwave-data] Transactions raw data sample:', 
      allTransactions.length > 0 ? JSON.stringify(allTransactions[0]).substring(0, 300) : 'Empty');

    // === MATCH TRANSACTIONS TO PLATFORM USERS BY EMAIL ===
    // Extract unique customer emails from transactions
    const uniqueEmails = [...new Set(
      allTransactions
        .map(t => t.customer?.email?.toLowerCase())
        .filter((email): email is string => !!email)
    )];

    console.log('[get-flutterwave-data] Unique customer emails to match:', uniqueEmails.length);

    // Create a service role client to query auth.users
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Lookup users by email in auth.users
    type EmailUserMap = Record<string, { user_id: string; email: string }>;
    const emailToUserMap: EmailUserMap = {};

    if (uniqueEmails.length > 0) {
      // Fetch auth users that match these emails
      const { data: authUsers, error: authError } = await serviceClient.auth.admin.listUsers({
        perPage: 1000,
      });

      if (authError) {
        console.error('[get-flutterwave-data] Error fetching auth users:', authError);
      } else if (authUsers?.users) {
        // Create email -> user_id map
        for (const authUser of authUsers.users) {
          if (authUser.email && uniqueEmails.includes(authUser.email.toLowerCase())) {
            emailToUserMap[authUser.email.toLowerCase()] = {
              user_id: authUser.id,
              email: authUser.email,
            };
          }
        }
        console.log('[get-flutterwave-data] Matched auth users:', Object.keys(emailToUserMap).length);
      }
    }

    // Get profile data for matched users
    const matchedUserIds = Object.values(emailToUserMap).map(u => u.user_id);
    type ProfileData = { id: string; full_name: string; avatar_url: string | null; is_member: boolean };
    const userProfiles: Record<string, ProfileData> = {};

    if (matchedUserIds.length > 0) {
      const { data: profiles, error: profilesError } = await serviceClient
        .from('profiles')
        .select('id, full_name, avatar_url, is_member')
        .in('id', matchedUserIds);

      if (profilesError) {
        console.error('[get-flutterwave-data] Error fetching profiles:', profilesError);
      } else if (profiles) {
        for (const profile of profiles) {
          userProfiles[profile.id] = profile;
        }
        console.log('[get-flutterwave-data] Fetched profiles:', Object.keys(userProfiles).length);
      }
    }

    // Enrich transactions with matched user data
    interface MatchedUser {
      user_id: string;
      full_name: string | null;
      avatar_url: string | null;
      is_member: boolean;
    }

    interface EnrichedTransaction extends FlutterwaveTransaction {
      matched_user: MatchedUser | null;
    }

    const enrichedTransactions: EnrichedTransaction[] = allTransactions.map(txn => {
      const customerEmail = txn.customer?.email?.toLowerCase();
      const matchedAuth = customerEmail ? emailToUserMap[customerEmail] : null;
      
      if (matchedAuth) {
        const profile = userProfiles[matchedAuth.user_id];
        return {
          ...txn,
          matched_user: {
            user_id: matchedAuth.user_id,
            full_name: profile?.full_name || null,
            avatar_url: profile?.avatar_url || null,
            is_member: profile?.is_member || false,
          },
        };
      }
      
      return {
        ...txn,
        matched_user: null,
      };
    });

    const matchedCount = enrichedTransactions.filter(t => t.matched_user).length;
    console.log('[get-flutterwave-data] Transactions matched to users:', matchedCount, 'of', enrichedTransactions.length);

    // Calculate summary statistics
    const pendingAmount = pendingTransfers.reduce((sum, t) => sum + (t.amount || 0), 0);
    const successfulAmount = successfulTransfers.reduce((sum, t) => sum + (t.amount || 0), 0);
    const failedAmount = failedTransfers.reduce((sum, t) => sum + (t.amount || 0), 0);

    const successfulDeposits = enrichedTransactions.filter(t => t.status === 'successful');
    const totalDepositsAmount = successfulDeposits.reduce((sum, t) => sum + (t.amount || 0), 0);

    const summary = {
      // Transfer stats (Money Sent Out)
      totalPending: pendingTransfers.length,
      totalPendingAmount: pendingAmount,
      totalSuccessful: successfulTransfers.length,
      totalSuccessfulAmount: successfulAmount,
      totalFailed: failedTransfers.length,
      totalFailedAmount: failedAmount,
      totalTransfers: allTransfers.length,
      
      // Transaction stats (Money Received)
      totalDeposits: enrichedTransactions.length,
      totalDepositsSuccessful: successfulDeposits.length,
      totalDepositsAmount: totalDepositsAmount,
      totalMatchedUsers: matchedCount,
    };

    // Format response
    const response = {
      success: true,
      fetchedAt: new Date().toISOString(),
      dateRange: {
        from: fromDate,
        to: toDate,
      },
      
      // Wallet balances - NGN ONLY
      balances: ngnBalance,
      
      // Transfers (Money Sent Out / Withdrawals)
      transfers: {
        all: allTransfers,
        pending: pendingTransfers,
        successful: successfulTransfers,
        failed: failedTransfers,
      },
      
      // Transactions (Money Received / Deposits) - NOW WITH MATCHED USER DATA
      transactions: enrichedTransactions,
      
      // Quick summary stats
      summary: summary,
    };

    console.log('[get-flutterwave-data] Success! NGN Balance:', ngnBalance.length, 
      'Transfers:', allTransfers.length, 'Transactions:', enrichedTransactions.length, 
      'Matched Users:', matchedCount);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[get-flutterwave-data] Error:', errorMessage);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch Flutterwave data',
        details: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
