import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated', errorCode: 'UNAUTHORIZED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } =
      await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated', errorCode: 'UNAUTHORIZED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { pin } = await req.json().catch(() => ({ pin: null }));
    if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      return new Response(
        JSON.stringify({ success: false, error: 'PIN must be exactly 4 digits', errorCode: 'VALIDATION_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delegate to bcrypt-backed SQL function. Run as the user so auth.uid() resolves.
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data, error } = await userClient.rpc('set_user_pin', { _pin: pin });
    if (error) {
      console.error('set_user_pin error:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create PIN', errorCode: 'SERVER_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = (data as any) || {};
    if (!result.success) {
      // If the backend already has a PIN, do not trap the user on this setup
      // screen. This can happen when the profile cache is stale after login.
      if (result.error === 'pin_already_set') {
        return new Response(
          JSON.stringify({ success: true, alreadySet: true, message: 'PIN already active' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const userMsg =
        result.error === 'pin_must_be_4_digits' ? 'PIN must be exactly 4 digits'
      : result.error === 'profile_not_found' ? 'Your account profile was not found. Please log in again.'
      : result.error === 'auth' ? 'Please log in again to create your PIN.'
      : result.error || 'Failed to create PIN';
      return new Response(
        JSON.stringify({ success: false, error: userMsg, errorCode: 'VALIDATION_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('PIN created successfully for user:', user.id);
    return new Response(
      JSON.stringify({ success: true, message: 'PIN created successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('create-pin unexpected:', e);
    return new Response(
      JSON.stringify({ success: false, error: 'An unexpected error occurred', errorCode: 'SERVER_ERROR' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
