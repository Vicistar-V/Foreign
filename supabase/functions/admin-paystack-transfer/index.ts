// admin-paystack-transfer — Paystack equivalent of admin-flutterwave-transfer.
// Same action surface so the React UI is reusable.
//
// Notes:
//  • Amounts to/from Paystack are in KOBO. We accept NAIRA from the client.
//  • Paystack transfers may require OTP if the merchant has it enabled. When
//    that happens we surface a clear message so the admin can finalize via
//    Paystack dashboard. We do NOT try to handle OTP in-app for v1.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) return json({ error: 'Not authenticated' }, 401);

    const { data: roleData } = await supabaseClient.rpc('has_role', {
      _user_id: user.id, _role: 'admin'
    });
    if (!roleData) return json({ error: 'Admin access required' }, 403);

    const body = await req.json();
    const { action, bank_code, account_number, amount, narration, transfer_id } = body;

    const key = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!key) return json({ error: 'Paystack not configured' }, 500);

    const headers = {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    };

    // ===== RESOLVE ACCOUNT =====
    if (action === 'resolve') {
      const url = `${PAYSTACK_BASE_URL}/bank/resolve?account_number=${encodeURIComponent(account_number)}&bank_code=${encodeURIComponent(bank_code)}`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      console.log('[admin-paystack-transfer] resolve:', data);
      if (data.status && data.data?.account_name) {
        return json({
          success: true,
          account_name: data.data.account_name,
          account_number,
          bank_code,
        });
      }
      return json({
        success: false,
        error: data.message || 'Could not verify this account. Please check the account number and bank.',
      }, 400);
    }

    // ===== TRANSFER MONEY =====
    if (action === 'transfer') {
      if (!amount || amount <= 0) {
        return json({ error: 'Amount must be greater than zero' }, 400);
      }

      // Step 1: create transfer recipient (NUBAN)
      const recipientRes = await fetch(`${PAYSTACK_BASE_URL}/transferrecipient`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: 'nuban',
          name: narration || 'Admin transfer',
          account_number,
          bank_code,
          currency: 'NGN',
        }),
      });
      const recipientData = await recipientRes.json();
      console.log('[admin-paystack-transfer] recipient:', recipientData);

      if (!recipientData.status || !recipientData.data?.recipient_code) {
        return json({
          success: false,
          error: recipientData.message || 'Could not create recipient.',
        }, 400);
      }

      // Step 2: initiate transfer (amount in kobo)
      const reference = `ADMIN-PS-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const transferRes = await fetch(`${PAYSTACK_BASE_URL}/transfer`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          source: 'balance',
          amount: Math.round(amount * 100),
          recipient: recipientData.data.recipient_code,
          reason: narration || 'Admin transfer',
          reference,
        }),
      });
      const transferData = await transferRes.json();
      console.log('[admin-paystack-transfer] transfer:', transferData);

      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Paystack may respond with status=true but require OTP. Detect that.
      const otpRequired = transferData.status && transferData.data?.status === 'otp';

      if (transferData.status && transferData.data) {
        await supabaseAdmin.from('system_alerts').insert({
          alert_type: 'admin_paystack_transfer',
          severity: 'info',
          message: `Admin initiated Paystack transfer of ₦${amount.toLocaleString()} to ${account_number}`,
          metadata: {
            admin_id: user.id,
            reference,
            amount,
            bank_code,
            account_number,
            narration,
            paystack_id: transferData.data.id,
            transfer_code: transferData.data.transfer_code,
            status: transferData.data.status,
            otp_required: otpRequired,
          },
        });

        return json({
          success: true,
          transfer_id: transferData.data.id,
          reference,
          status: transferData.data.status,
          message: otpRequired
            ? 'Transfer started but Paystack requires OTP. Finalize it on the Paystack dashboard.'
            : 'Transfer initiated successfully',
        });
      }

      return json({
        success: false,
        error: transferData.message || 'Transfer failed. Please try again.',
      }, 400);
    }

    // ===== GET STATUS =====
    if (action === 'get_status') {
      if (!transfer_id) return json({ error: 'Transfer ID is required' }, 400);
      const res = await fetch(`${PAYSTACK_BASE_URL}/transfer/${transfer_id}`, { headers });
      const data = await res.json();
      console.log('[admin-paystack-transfer] status:', data);

      if (data.status && data.data) {
        const t = data.data;
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        await supabaseAdmin.from('system_alerts').insert({
          alert_type: 'admin_paystack_status_check',
          severity: 'info',
          message: `Admin checked status of Paystack transfer ${transfer_id} - Status: ${t.status}`,
          metadata: {
            admin_id: user.id,
            transfer_id,
            status: t.status,
            account_number: t.recipient?.details?.account_number,
            bank_name: t.recipient?.details?.bank_name,
            amount: t.amount / 100,
            reference: t.reference,
          },
        });
        return json({
          success: true,
          transfer_id: t.id,
          reference: t.reference,
          status: t.status,
          complete_message: t.failure_reason || t.reason || '',
          bank_name: t.recipient?.details?.bank_name,
          account_number: t.recipient?.details?.account_number,
          full_name: t.recipient?.name,
          amount: t.amount / 100,
          message: `Status: ${t.status}`,
        });
      }
      return json({ success: false, error: data.message || 'Could not fetch transfer status' }, 400);
    }

    // Paystack has no direct "retry" endpoint. We block this action and tell the admin.
    if (action === 'retry') {
      return json({
        success: false,
        error: 'Paystack does not support retrying a transfer. Send a new transfer instead.',
      }, 400);
    }

    return json({ error: 'Invalid action. Use "resolve", "transfer", or "get_status".' }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[admin-paystack-transfer] error:', msg);
    return json({ error: 'Transfer operation failed', details: msg }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
