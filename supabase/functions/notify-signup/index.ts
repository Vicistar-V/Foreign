// Sends a Telegram alert when a new user signs up.
// Called from the client immediately after a successful auth.signUp.
// Not a database trigger — invoked explicitly by the frontend so it stays
// easy to control, debug, and retire without touching DB schema.

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey);

    // Identify the user from their JWT (newly created session).
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch profile for the alert payload. Profile may not exist yet if the
    // post-signup trigger hasn't fired — fall back to auth metadata.
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone_number, email, referred_by_code')
      .eq('id', user.id)
      .maybeSingle();

    const meta = (user.user_metadata ?? {}) as Record<string, any>;
    const userName = profile?.full_name || meta.full_name || 'New user';
    const userPhone = profile?.phone_number || meta.phone_number || '';
    const userEmail = profile?.email || user.email || '';

    // Resolve referrer name if a referral code was used.
    let referrerName: string | undefined;
    let referrerCode: string | undefined;
    const refCode = profile?.referred_by_code || meta.referred_by_code || null;
    if (refCode) {
      referrerCode = String(refCode);
      const { data: referrer } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('referral_code', refCode)
        .maybeSingle();
      referrerName = referrer?.full_name;
    }

    // Fire the actual Telegram alert via the trusted backend function.
    const { error: alertError } = await supabase.functions.invoke('send-telegram-alert', {
      body: {
        alertType: 'signup',
        userId: user.id,
        userName,
        userPhone,
        userEmail,
        referrerCode,
        referrerName,
      },
    });

    if (alertError) {
      console.error('notify-signup: alert error', alertError);
      return new Response(
        JSON.stringify({ success: false, error: alertError.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('notify-signup: error', error);
    const message = error instanceof Error ? error.message : 'Internal error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
