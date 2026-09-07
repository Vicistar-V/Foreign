import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { safeJson } from '../_shared/safe-json.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  console.log('🚀 initiate-paystack-payment: Function called');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { amount, metadata } = body || {};
    const purpose = metadata?.purpose || 'deposit';

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // -------- Identity (auth required) --------
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not logged in', errorCode: 'UNAUTHORIZED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const jwt = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    const userId = payload.sub;
    const userEmail = payload.email;
    if (!userId || !userEmail) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not logged in', errorCode: 'UNAUTHORIZED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();
    const customerName = profile?.full_name || 'User';

    // -------- Maintenance check --------
    const { data: config, error: configError } = await supabaseClient
      .from('platform_config')
      .select('maintenance_mode')
      .eq('id', 1)
      .single();
    if (configError) {
      return new Response(
        JSON.stringify({ success: false, error: 'System error', errorCode: 'SERVER_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (config.maintenance_mode) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Platform is under maintenance',
          details: 'We are making improvements. Please check back shortly.',
          reason: 'maintenance_mode',
          errorCode: 'MAINTENANCE',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // -------- Amount + fee (same hidden ₦10 logic as Flutterwave) --------
    if (!amount || amount < 100) {
      return new Response(
        JSON.stringify({ success: false, error: 'Minimum amount is ₦100', errorCode: 'VALIDATION_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const PROCESSING_FEE = 10;
    const chargeAmount = amount + PROCESSING_FEE;

    // -------- Callback URL --------
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/');
    const frontendUrl = origin || 'https://viketa.xyz';
    const callbackUrl = `https://sbprvewcfrtazdlcfvxt.supabase.co/functions/v1/paystack-callback?origin=${encodeURIComponent(frontendUrl)}`;

    // -------- Reference (tagged PSK so callback/webhook always know it's Paystack) --------
    const txPrefix = purpose === 'membership' ? 'MEM-PSK' : 'DEP-PSK';
    const reference = `${txPrefix}-${userId}-${Date.now()}`;

    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      console.error('❌ PAYSTACK_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Paystack is not configured yet',
          details: 'Admin must add the Paystack secret key.',
          errorCode: 'SERVER_ERROR',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Paystack expects amount in kobo (naira * 100)
    const initPayload = {
      email: userEmail,
      amount: Math.round(chargeAmount * 100),
      currency: 'NGN',
      reference,
      callback_url: callbackUrl,
      channels: ['bank_transfer'], // ← bank transfer only, matches Flutterwave UX
      metadata: {
        user_id: userId,
        purpose,
        expected_amount: amount,
        processing_fee: PROCESSING_FEE,
        charged_amount: chargeAmount,
        customer_name: customerName,
        custom_fields: [
          { display_name: 'Customer', variable_name: 'customer_name', value: customerName },
          { display_name: 'Purpose', variable_name: 'purpose', value: purpose },
        ],
        ...(metadata || {}),
      },
    };

    const paystackResp = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(initPayload),
    });
    const psParsed = await safeJson<any>(paystackResp);
    if (!psParsed.ok) {
      console.error('❌ Paystack non-JSON response:', psParsed.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Payment gateway is temporarily unavailable. Please try again in a moment.',
          details: psParsed.error,
          errorCode: 'GATEWAY_UNAVAILABLE',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const paystackData = psParsed.data;

    if (paystackData.status === true && paystackData.data?.authorization_url) {
      // Record the attempt so the user can self-verify if the callback never lands.
      await supabaseClient.from('payment_attempts').insert({
        user_id: userId,
        tx_ref: reference,
        amount,
        purpose: purpose === 'membership' ? 'membership' : 'deposit',
        status: 'pending',
        provider: 'paystack',
        metadata: {
          initiated_at: new Date().toISOString(),
          customer_email: userEmail,
          paystack_access_code: paystackData.data?.access_code,
          // Honored by admin-approve-payment-attempt → runAutoBuySpots
          auto_buy_spots: Math.max(0, Math.min(Number((metadata as any)?.auto_buy_spots) || 0, 100)),
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          paymentLink: paystackData.data.authorization_url,
          reference,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.error('❌ Paystack init error:', paystackData);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to start Paystack payment',
        details: paystackData.message || 'Unknown Paystack error',
        errorCode: 'SERVER_ERROR',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('💥 Unexpected error in initiate-paystack-payment:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: errorMessage,
        errorCode: 'SERVER_ERROR',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
