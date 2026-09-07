import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { safeJson } from '../_shared/safe-json.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  console.log('🚀 initiate-deposit: Function called');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { amount, metadata, guest_name, guest_email } = body || {};
    const purpose = metadata?.purpose || 'deposit';
    const isMentorship = purpose === 'mentorship';

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // -------- Identity resolution --------
    let userId: string | null = null;
    let userEmail: string | null = null;
    let customerName = 'Customer';

    if (isMentorship) {
      // Guest checkout path — no auth required.
      if (!guest_name || !guest_email || !String(guest_email).includes('@')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Name and email are required', errorCode: 'VALIDATION_ERROR' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userEmail = String(guest_email);
      customerName = String(guest_name);
    } else {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ success: false, error: 'Not authenticated', errorCode: 'UNAUTHORIZED' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const jwt = authHeader.replace('Bearer ', '');
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      userId = payload.sub;
      userEmail = payload.email;
      if (!userId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Not authenticated', errorCode: 'UNAUTHORIZED' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();
      customerName = profile?.full_name || 'User';
    }

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
    if (config.maintenance_mode && !isMentorship) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Platform is under maintenance',
          details: 'We are making improvements to serve you better. Please check back shortly.',
          reason: 'maintenance_mode',
          errorCode: 'MAINTENANCE',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // -------- Amount + fee --------
    if (!amount || amount < 100) {
      return new Response(
        JSON.stringify({ success: false, error: 'Minimum amount is ₦100', errorCode: 'VALIDATION_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const PROCESSING_FEE = isMentorship ? 0 : 10;
    const chargeAmount = amount + PROCESSING_FEE;

    // -------- Callback / origin --------
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/');
    const frontendUrl = origin || 'https://sbprvewcfrtazdlcfvxt.lovable.app';
    const callbackUrl = `https://sbprvewcfrtazdlcfvxt.supabase.co/functions/v1/flutterwave-callback?origin=${encodeURIComponent(frontendUrl)}`;

    // -------- Customer-facing branding (NEVER expose internal tags here) --------
    const fwTitle = isMentorship
      ? 'Viketa Mentorship'
      : 'Flutterwave/ViciMasterPro';
    const fwDescription = isMentorship
      ? 'Viketa Mentorship Program — lifetime access'
      : (purpose === 'membership' ? 'Activate your membership' : 'Secure deposit to your wallet');

    const txPrefix = isMentorship ? 'MEN' : 'DEP';
    const txRef = `${txPrefix}-${userId || 'guest'}-${Date.now()}`;

    const paymentPayload = {
      tx_ref: txRef,
      amount: chargeAmount,
      currency: 'NGN',
      redirect_url: callbackUrl,
      payment_options: 'banktransfer',
      customer: {
        email: userEmail,
        name: customerName,
      },
      customizations: {
        title: fwTitle,
        description: fwDescription,
        logo: `${frontendUrl}/logo.png`,
      },
      meta: {
        user_id: userId,
        purpose,
        expected_amount: amount,
        processing_fee: PROCESSING_FEE,
        charged_amount: chargeAmount,
        ...(metadata || {}),
      },
    };

    const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
    const flutterwaveResponse = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${flutterwaveSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentPayload),
    });
    const fwParsed = await safeJson<any>(flutterwaveResponse);
    if (!fwParsed.ok) {
      console.error('❌ Flutterwave non-JSON response:', fwParsed.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Payment gateway is temporarily unavailable. Please try again in a moment.',
          details: fwParsed.error,
          errorCode: 'GATEWAY_UNAVAILABLE',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const flutterwaveData = fwParsed.data;

    if (flutterwaveData.status === 'success') {
      // Only record payment_attempts for authenticated flows (table requires user_id).
      if (userId && !isMentorship) {
        await supabaseClient.from('payment_attempts').insert({
          user_id: userId,
          tx_ref: paymentPayload.tx_ref,
          amount,
          purpose: purpose === 'membership' ? 'membership' : 'deposit',
          status: 'pending',
          metadata: {
            initiated_at: new Date().toISOString(),
            customer_email: userEmail,
            // Honored by admin-approve-payment-attempt → runAutoBuySpots
            auto_buy_spots: Math.max(0, Math.min(Number((metadata as any)?.auto_buy_spots) || 0, 100)),
          },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          paymentLink: flutterwaveData.data.link,
          reference: paymentPayload.tx_ref,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.error('❌ Flutterwave error:', flutterwaveData);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to initialize payment',
          details: flutterwaveData.message || 'Unknown error',
          errorCode: 'SERVER_ERROR',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('💥 Unexpected error in initiate-deposit:', error);
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
