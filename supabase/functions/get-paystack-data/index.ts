// get-paystack-data — mirror of get-flutterwave-data, normalized to the
// SAME response shape so the existing admin UI components work unchanged.
//
// Paystack amounts are in KOBO (1 NGN = 100 kobo). We normalize everything
// to NAIRA before returning, so the UI's formatNaira() works as-is.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return json({ error: 'Not authenticated' }, 401);
    }

    const { data: roleData } = await supabaseClient.rpc('has_role', {
      _user_id: user.id, _role: 'admin'
    });
    if (!roleData) {
      return json({ error: 'Admin access required' }, 403);
    }

    let fromDate: string | null = null;
    let toDate: string | null = null;
    try {
      const body = await req.json();
      fromDate = body.fromDate || null;
      toDate = body.toDate || null;
    } catch { /* ignore */ }

    const paystackKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackKey) {
      return json({ error: 'Paystack not configured' }, 500);
    }

    const headers = {
      'Authorization': `Bearer ${paystackKey}`,
      'Content-Type': 'application/json',
    };

    const dateParams = () => {
      const p = new URLSearchParams();
      p.append('perPage', '100');
      p.append('page', '1');
      if (fromDate) p.append('from', fromDate);
      if (toDate) p.append('to', toDate);
      return p.toString();
    };

    console.log('[get-paystack-data] Fetching with date:', fromDate, '→', toDate);

    const [balanceRes, transferRes, txRes] = await Promise.all([
      fetch(`${PAYSTACK_BASE_URL}/balance`, { headers }),
      fetch(`${PAYSTACK_BASE_URL}/transfer?${dateParams()}`, { headers }),
      fetch(`${PAYSTACK_BASE_URL}/transaction?${dateParams()}`, { headers }),
    ]);

    const balanceData = await balanceRes.json();
    const transferData = await transferRes.json();
    const txData = await txRes.json();

    // ---- Balances (kobo → naira, NGN only) ----
    const balances = (balanceData.status && Array.isArray(balanceData.data))
      ? balanceData.data
          .filter((b: any) => b.currency === 'NGN')
          .map((b: any) => ({
            currency: b.currency,
            available_balance: Number(b.balance || 0) / 100,
            ledger_balance: Number(b.balance || 0) / 100,
          }))
      : [];

    // ---- Transfers (normalize to Flutterwave-style shape) ----
    const allTransfers = (transferData.status && Array.isArray(transferData.data))
      ? transferData.data.map((t: any) => {
          const status = mapTransferStatus(t.status);
          return {
            id: t.id,
            account_number: t.recipient?.details?.account_number || '',
            bank_name: t.recipient?.details?.bank_name || '',
            full_name: t.recipient?.name || t.recipient?.details?.account_name || '',
            amount: Number(t.amount || 0) / 100,
            currency: t.currency || 'NGN',
            reference: t.reference || '',
            status, // normalized: 'successful' | 'failed' | 'pending'
            complete_message: t.failure_reason || t.reason || '',
            created_at: t.createdAt || t.created_at,
            fee: 0, // Paystack returns this on individual fetch, not list
            meta: { paystack_status: t.status, recipient_code: t.recipient?.recipient_code },
          };
        })
      : [];

    const pendingTransfers = allTransfers.filter((t: any) => t.status === 'pending');
    const successfulTransfers = allTransfers.filter((t: any) => t.status === 'successful');
    const failedTransfers = allTransfers.filter((t: any) => t.status === 'failed');

    // ---- Transactions (normalize) ----
    const allTransactions = (txData.status && Array.isArray(txData.data))
      ? txData.data.map((t: any) => ({
          id: t.id,
          tx_ref: t.reference || '',
          flw_ref: t.reference || '',
          device_fingerprint: '',
          amount: Number(t.amount || 0) / 100,
          currency: t.currency || 'NGN',
          charged_amount: Number(t.amount || 0) / 100,
          app_fee: Number(t.fees || 0) / 100,
          merchant_fee: 0,
          processor_response: t.gateway_response || '',
          auth_model: t.authorization?.channel || '',
          ip: t.ip_address || '',
          narration: t.message || '',
          status: mapTxStatus(t.status),
          payment_type: t.channel || '',
          created_at: t.paid_at || t.created_at || t.createdAt,
          customer: {
            id: t.customer?.id || 0,
            name: [t.customer?.first_name, t.customer?.last_name].filter(Boolean).join(' ') || t.customer?.email || '',
            phone_number: t.customer?.phone || '',
            email: t.customer?.email || '',
          },
        }))
      : [];

    // ---- Match transactions to platform users by email (same as flutterwave) ----
    const uniqueEmails = [...new Set(
      allTransactions.map((t: any) => t.customer?.email?.toLowerCase()).filter(Boolean)
    )] as string[];

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const emailToUserId: Record<string, string> = {};
    if (uniqueEmails.length > 0) {
      const { data: authUsers } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
      if (authUsers?.users) {
        for (const u of authUsers.users) {
          if (u.email && uniqueEmails.includes(u.email.toLowerCase())) {
            emailToUserId[u.email.toLowerCase()] = u.id;
          }
        }
      }
    }

    const matchedIds = Object.values(emailToUserId);
    const profiles: Record<string, any> = {};
    if (matchedIds.length > 0) {
      const { data } = await serviceClient
        .from('profiles')
        .select('id, full_name, avatar_url, is_member')
        .in('id', matchedIds);
      for (const p of (data || [])) profiles[p.id] = p;
    }

    const enrichedTransactions = allTransactions.map((t: any) => {
      const uid = emailToUserId[t.customer?.email?.toLowerCase() || ''];
      const profile = uid ? profiles[uid] : null;
      return {
        ...t,
        matched_user: profile ? {
          user_id: uid,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          is_member: profile.is_member,
        } : null,
      };
    });

    const matchedCount = enrichedTransactions.filter((t: any) => t.matched_user).length;

    // ---- Summary ----
    const summary = {
      totalPending: pendingTransfers.length,
      totalPendingAmount: pendingTransfers.reduce((s: number, t: any) => s + t.amount, 0),
      totalSuccessful: successfulTransfers.length,
      totalSuccessfulAmount: successfulTransfers.reduce((s: number, t: any) => s + t.amount, 0),
      totalFailed: failedTransfers.length,
      totalFailedAmount: failedTransfers.reduce((s: number, t: any) => s + t.amount, 0),
      totalTransfers: allTransfers.length,
      totalDeposits: allTransactions.length,
      totalDepositsSuccessful: allTransactions.filter((t: any) => t.status === 'successful').length,
      totalDepositsAmount: allTransactions
        .filter((t: any) => t.status === 'successful')
        .reduce((s: number, t: any) => s + t.amount, 0),
      totalMatchedUsers: matchedCount,
    };

    return json({
      success: true,
      fetchedAt: new Date().toISOString(),
      dateRange: { from: fromDate, to: toDate },
      balances,
      transfers: {
        all: allTransfers,
        pending: pendingTransfers,
        successful: successfulTransfers,
        failed: failedTransfers,
      },
      transactions: enrichedTransactions,
      summary,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[get-paystack-data] Error:', msg);
    return json({ error: 'Failed to fetch Paystack data', details: msg }, 500);
  }
});

function mapTransferStatus(s: string): string {
  const v = (s || '').toLowerCase();
  if (v === 'success' || v === 'successful') return 'successful';
  if (v === 'failed' || v === 'reversed') return 'failed';
  return 'pending'; // pending, otp, processing, etc.
}

function mapTxStatus(s: string): string {
  const v = (s || '').toLowerCase();
  if (v === 'success' || v === 'successful') return 'successful';
  if (v === 'failed' || v === 'abandoned') return 'failed';
  return 'pending';
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
