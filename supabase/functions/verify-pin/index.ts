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
        JSON.stringify({ success: false, valid: false, error: 'Not authenticated', errorCode: 'UNAUTHORIZED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } =
      await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, valid: false, error: 'Not authenticated', errorCode: 'UNAUTHORIZED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { pin } = await req.json().catch(() => ({ pin: null }));
    if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      return new Response(
        JSON.stringify({ success: false, valid: false, error: 'PIN must be exactly 4 digits', errorCode: 'VALIDATION_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data, error } = await userClient.rpc('verify_user_pin', { _pin: pin });
    if (error) {
      console.error('verify_user_pin error:', error);
      return new Response(
        JSON.stringify({ success: false, valid: false, error: 'Verification failed', errorCode: 'SERVER_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = (data as any) || {};
    const isValid = result.valid === true;
    console.log('PIN verification result for', user.id, ':', isValid ? 'Valid' : 'Invalid', result.error || '');

    return new Response(
      JSON.stringify({ success: true, valid: isValid, error: isValid ? undefined : result.error }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('verify-pin unexpected:', e);
    return new Response(
      JSON.stringify({ success: false, valid: false, error: 'An unexpected error occurred', errorCode: 'SERVER_ERROR' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
