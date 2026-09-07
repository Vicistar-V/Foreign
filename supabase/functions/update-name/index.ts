import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header', errorCode: 'UNAUTHORIZED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized', errorCode: 'UNAUTHORIZED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { fullName, pin } = await req.json();

    // Validate inputs
    if (!fullName || typeof fullName !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Full name is required', errorCode: 'VALIDATION_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pin || typeof pin !== 'string' || pin.length !== 4) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid 4-digit PIN is required', errorCode: 'VALIDATION_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedName = fullName.trim();

    // Validate name
    if (trimmedName.length < 2) {
      return new Response(
        JSON.stringify({ success: false, error: 'Name must be at least 2 characters long', errorCode: 'VALIDATION_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (trimmedName.length > 100) {
      return new Response(
        JSON.stringify({ success: false, error: 'Name must be less than 100 characters', errorCode: 'VALIDATION_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify PIN using the verify-pin edge function
    const { data: pinVerification, error: pinError } = await supabase.functions.invoke('verify-pin', {
      body: { pin },
      headers: { Authorization: authHeader }
    });

    if (pinError || !pinVerification?.valid) {
      console.error('PIN verification failed:', pinError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid PIN', errorCode: 'INVALID_PIN' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if name is locked (double-check on backend)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_name_locked, is_banned')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch profile', errorCode: 'SERVER_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (profile.is_banned) {
      return new Response(
        JSON.stringify({ success: false, error: 'Your account has been suspended', errorCode: 'BANNED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (profile.is_name_locked) {
      return new Response(
        JSON.stringify({ success: false, error: 'Your name is locked and cannot be changed. Contact support if you need assistance.', errorCode: 'NAME_LOCKED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the name
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: trimmedName })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating name:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update name', errorCode: 'SERVER_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Name updated successfully for user ${user.id}: ${trimmedName}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Name updated successfully',
        fullName: trimmedName
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in update-name function:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An unexpected error occurred', errorCode: 'SERVER_ERROR' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});