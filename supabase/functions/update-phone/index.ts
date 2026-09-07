import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated', errorCode: 'UNAUTHORIZED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated', errorCode: 'UNAUTHORIZED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { phoneNumber, pin } = await req.json();

    // CRITICAL: Verify PIN before allowing phone update
    if (!pin) {
      return new Response(
        JSON.stringify({ success: false, error: 'PIN is required for this action', errorCode: 'VALIDATION_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate PIN format (4 digits)
    if (!/^\d{4}$/.test(pin)) {
      return new Response(
        JSON.stringify({ success: false, error: 'PIN must be exactly 4 digits', errorCode: 'VALIDATION_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's banned status before allowing any profile change
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_banned, banned_reason')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Failed to fetch profile:', profileError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to verify identity', errorCode: 'SERVER_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Block banned users from updating phone (anti-fraud measure)
    if (profile.is_banned) {
      console.log('[update-phone] Banned user attempted to update phone:', user.id);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Your account has been suspended',
          reason: profile.banned_reason,
          errorCode: 'BANNED'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify PIN through the single bcrypt-backed verifier.
    const { data: pinResponse, error: pinError } = await supabase.functions.invoke('verify-pin', {
      body: { pin },
      headers: { Authorization: authHeader },
    });

    if (pinError || !pinResponse?.valid) {
      return new Response(
        JSON.stringify({ success: false, error: pinResponse?.error || 'Incorrect PIN', errorCode: 'INVALID_PIN' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate phone number format if provided (Nigerian format)
    if (phoneNumber && phoneNumber.trim() !== '') {
      const phoneRegex = /^(\+?234|0)[789]\d{9}$/;
      if (!phoneRegex.test(phoneNumber.replace(/[\s-]/g, ''))) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid phone number format. Use Nigerian format (e.g., 08012345678)', errorCode: 'VALIDATION_ERROR' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Update profile with new phone number
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ phone_number: phoneNumber || null })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update phone:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update phone number', errorCode: 'SERVER_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Phone number updated successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error', errorCode: 'SERVER_ERROR' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});