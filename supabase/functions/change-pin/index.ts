import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

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

    const { data: { user }, error: userError } =
      await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated', errorCode: 'UNAUTHORIZED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { oldPin, newPin } = await req.json().catch(() => ({ oldPin: null, newPin: null }));

    if (!oldPin || !newPin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Old PIN and new PIN are required', errorCode: 'VALIDATION_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!/^\d{4}$/.test(newPin)) {
      return new Response(
        JSON.stringify({ success: false, error: 'New PIN must be exactly 4 digits', errorCode: 'VALIDATION_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atomic verify+update via SQL RPC, run as the signed-in user.
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data, error } = await userClient.rpc('change_user_pin', {
      _old_pin: oldPin,
      _new_pin: newPin,
    });

    if (error) {
      console.error('change_user_pin error:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to change PIN', errorCode: 'SERVER_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = (data as any) || {};
    if (!result.success) {
      const errCode = result.error === 'invalid_pin' ? 'INVALID_PIN' : 'VALIDATION_ERROR';
      const userMsg =
        result.error === 'invalid_pin'    ? 'Current PIN is incorrect'
      : result.error === 'no_pin_set'     ? 'No PIN is set yet — create one first'
      : result.error === 'pin_must_be_4_digits' ? 'New PIN must be exactly 4 digits'
      :                                     'Failed to change PIN';
      return new Response(
        JSON.stringify({ success: false, error: userMsg, errorCode: errCode }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('PIN changed successfully for user:', user.id);
    return new Response(
      JSON.stringify({ success: true, message: 'PIN changed successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('change-pin unexpected:', e);
    return new Response(
      JSON.stringify({ success: false, error: e?.message || 'Internal server error', errorCode: 'SERVER_ERROR' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
