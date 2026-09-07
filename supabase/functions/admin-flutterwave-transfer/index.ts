import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3';

interface TransferRequest {
  action: 'resolve' | 'transfer' | 'get_status' | 'retry';
  bank_code?: string;
  account_number?: string;
  amount?: number;
  narration?: string;
  transfer_id?: number;
}

interface ResolveResponse {
  success: boolean;
  account_name?: string;
  account_number?: string;
  bank_code?: string;
  error?: string;
}

interface TransferResponse {
  success: boolean;
  transfer_id?: number;
  reference?: string;
  status?: string;
  message?: string;
  error?: string;
  complete_message?: string;
  bank_name?: string;
  account_number?: string;
  full_name?: string;
  amount?: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ====================
    // STEP 1: VERIFY ADMIN
    // ====================
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('[admin-flutterwave-transfer] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: roleData, error: roleError } = await supabaseClient
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (roleError || !roleData) {
      console.error('[admin-flutterwave-transfer] Not admin:', roleError);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[admin-flutterwave-transfer] Admin verified:', user.id);

    // ====================
    // STEP 2: PARSE REQUEST
    // ====================
    const body: TransferRequest = await req.json();
    const { action, bank_code, account_number, amount, narration } = body;

    console.log('[admin-flutterwave-transfer] Action:', action, 'Bank:', bank_code, 'Account:', account_number);

    const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
    if (!flutterwaveSecretKey) {
      console.error('[admin-flutterwave-transfer] Missing FLUTTERWAVE_SECRET_KEY');
      return new Response(
        JSON.stringify({ error: 'Flutterwave not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const headers = {
      'Authorization': `Bearer ${flutterwaveSecretKey}`,
      'Content-Type': 'application/json',
    };

    // ====================
    // ACTION: RESOLVE ACCOUNT
    // ====================
    if (action === 'resolve') {
      console.log('[admin-flutterwave-transfer] Resolving account...');
      
      const resolvePayload = {
        account_number: account_number,
        account_bank: bank_code,
      };

      console.log('[admin-flutterwave-transfer] Resolve payload:', JSON.stringify(resolvePayload));

      const resolveRes = await fetch(`${FLUTTERWAVE_BASE_URL}/accounts/resolve`, {
        method: 'POST',
        headers,
        body: JSON.stringify(resolvePayload),
      });

      const resolveData = await resolveRes.json();
      console.log('[admin-flutterwave-transfer] Resolve response:', JSON.stringify(resolveData));

      if (resolveData.status === 'success' && resolveData.data) {
        const response: ResolveResponse = {
          success: true,
          account_name: resolveData.data.account_name,
          account_number: account_number,
          bank_code: bank_code,
        };
        return new Response(
          JSON.stringify(response),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        const response: ResolveResponse = {
          success: false,
          error: resolveData.message || 'Could not verify this account. Please check the account number and bank.',
        };
        return new Response(
          JSON.stringify(response),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ====================
    // ACTION: TRANSFER MONEY
    // ====================
    if (action === 'transfer') {
      if (!amount || amount <= 0) {
        return new Response(
          JSON.stringify({ error: 'Amount must be greater than zero' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate unique reference
      const reference = `ADMIN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      console.log('[admin-flutterwave-transfer] Initiating transfer...');
      console.log('[admin-flutterwave-transfer] Reference:', reference);
      console.log('[admin-flutterwave-transfer] Amount:', amount);

      const transferPayload = {
        account_bank: bank_code,
        account_number: account_number,
        amount: amount,
        narration: narration || 'Admin transfer',
        currency: 'NGN',
        reference: reference,
        debit_currency: 'NGN',
      };

      console.log('[admin-flutterwave-transfer] Transfer payload:', JSON.stringify(transferPayload));

      const transferRes = await fetch(`${FLUTTERWAVE_BASE_URL}/transfers`, {
        method: 'POST',
        headers,
        body: JSON.stringify(transferPayload),
      });

      const transferData = await transferRes.json();
      console.log('[admin-flutterwave-transfer] Transfer response:', JSON.stringify(transferData));

      if (transferData.status === 'success' && transferData.data) {
        // Log admin action using service role
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        await supabaseAdmin.from('system_alerts').insert({
          alert_type: 'admin_flutterwave_transfer',
          severity: 'info',
          message: `Admin initiated Flutterwave transfer of ₦${amount.toLocaleString()} to ${account_number}`,
          metadata: {
            admin_id: user.id,
            reference: reference,
            amount: amount,
            bank_code: bank_code,
            account_number: account_number,
            narration: narration,
            flutterwave_id: transferData.data.id,
            status: transferData.data.status,
          },
        });

        const response: TransferResponse = {
          success: true,
          transfer_id: transferData.data.id,
          reference: reference,
          status: transferData.data.status,
          message: transferData.data.complete_message || 'Transfer initiated successfully',
        };
        return new Response(
          JSON.stringify(response),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        console.error('[admin-flutterwave-transfer] Transfer failed:', transferData);
        
        const response: TransferResponse = {
          success: false,
          error: transferData.message || 'Transfer failed. Please try again.',
        };
        return new Response(
          JSON.stringify(response),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ====================
    // ACTION: GET TRANSFER STATUS
    // ====================
    if (action === 'get_status') {
      const { transfer_id } = body;
      
      if (!transfer_id) {
        return new Response(
          JSON.stringify({ error: 'Transfer ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[admin-flutterwave-transfer] Getting status for transfer:', transfer_id);

      const statusRes = await fetch(`${FLUTTERWAVE_BASE_URL}/transfers/${transfer_id}`, {
        method: 'GET',
        headers,
      });

      const statusData = await statusRes.json();
      console.log('[admin-flutterwave-transfer] Status response:', JSON.stringify(statusData));

      if (statusData.status === 'success' && statusData.data) {
        const transferInfo = statusData.data;

        // Log status check action using service role
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        await supabaseAdmin.from('system_alerts').insert({
          alert_type: 'admin_transfer_status_check',
          severity: 'info',
          message: `Admin checked status of transfer ID: ${transfer_id} - Status: ${transferInfo.status}`,
          metadata: {
            admin_id: user.id,
            transfer_id: transfer_id,
            status: transferInfo.status,
            account_number: transferInfo.account_number,
            bank_name: transferInfo.bank_name,
            amount: transferInfo.amount,
            reference: transferInfo.reference,
          },
        });

        const response: TransferResponse = {
          success: true,
          transfer_id: transferInfo.id,
          reference: transferInfo.reference,
          status: transferInfo.status,
          complete_message: transferInfo.complete_message,
          bank_name: transferInfo.bank_name,
          account_number: transferInfo.account_number,
          full_name: transferInfo.full_name,
          amount: transferInfo.amount,
          message: `Status: ${transferInfo.status}`,
        };
        return new Response(
          JSON.stringify(response),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: statusData.message || 'Could not fetch transfer status' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ====================
    // ACTION: RETRY FAILED TRANSFER
    // ====================
    if (action === 'retry') {
      const { transfer_id } = body;
      
      if (!transfer_id) {
        return new Response(
          JSON.stringify({ error: 'Transfer ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[admin-flutterwave-transfer] Retrying transfer:', transfer_id);

      const retryRes = await fetch(`${FLUTTERWAVE_BASE_URL}/transfers/${transfer_id}/retries`, {
        method: 'POST',
        headers,
      });

      const retryData = await retryRes.json();
      console.log('[admin-flutterwave-transfer] Retry response:', JSON.stringify(retryData));

      // Log admin action using service role
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      await supabaseAdmin.from('system_alerts').insert({
        alert_type: 'admin_transfer_retry',
        severity: 'info',
        message: `Admin retried Flutterwave transfer ID: ${transfer_id}`,
        metadata: {
          admin_id: user.id,
          transfer_id: transfer_id,
          retry_response: retryData,
        },
      });

      if (retryData.status === 'success' && retryData.data) {
        const response: TransferResponse = {
          success: true,
          transfer_id: retryData.data.id,
          status: retryData.data.status,
          message: 'Transfer retry initiated successfully',
        };
        return new Response(
          JSON.stringify(response),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: retryData.message || 'Could not retry transfer. It may not be in a failed state.' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Invalid action
    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "resolve", "transfer", "get_status", or "retry".' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[admin-flutterwave-transfer] Error:', errorMessage);
    return new Response(
      JSON.stringify({ 
        error: 'Transfer operation failed',
        details: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
