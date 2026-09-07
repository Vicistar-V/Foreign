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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Client for regular operations
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    // Admin client for password update
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('change-password: No authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error('change-password: User authentication failed:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('change-password: Processing password change for user:', user.id);

    // Parse request body
    const { currentPassword, newPassword, confirmPassword, pin } = await req.json();

    // Validate required fields
    if (!currentPassword || !newPassword || !confirmPassword || !pin) {
      console.error('change-password: Missing required fields');
      return new Response(
        JSON.stringify({ success: false, error: 'Current password, new password, confirmation, and PIN are required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL: Verify PIN before allowing password change
    console.log('change-password: Validating PIN format');
    if (!/^\d{4}$/.test(pin)) {
      return new Response(
        JSON.stringify({ success: false, error: 'PIN must be exactly 4 digits' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify PIN through the single bcrypt-backed verifier.
    console.log('change-password: Verifying PIN');
    const { data: pinResponse, error: pinError } = await supabaseAdmin.functions.invoke('verify-pin', {
      body: { pin },
      headers: { Authorization: authHeader },
    });

    if (pinError || !pinResponse?.valid) {
      console.error('change-password: PIN verification failed:', pinError || pinResponse?.error);
      return new Response(
        JSON.stringify({ success: false, error: pinResponse?.error || 'Incorrect PIN' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('change-password: PIN verified successfully');

    // Step 1: Verify current password by attempting sign-in
    console.log('change-password: Verifying current password for user:', user.email);
    
    const { error: signInError } = await supabaseClient.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    });

    if (signInError) {
      console.error('change-password: Current password verification failed:', signInError.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Current password is incorrect' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('change-password: Current password verified successfully');

    // Step 2: Validate new password
    if (newPassword.length < 8) {
      console.error('change-password: New password too short');
      return new Response(
        JSON.stringify({ success: false, error: 'New password must be at least 8 characters long' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check password strength
    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    
    if (!hasLetter || !hasNumber) {
      console.error('change-password: New password does not meet strength requirements');
      return new Response(
        JSON.stringify({ success: false, error: 'New password must contain both letters and numbers' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Check passwords match
    if (newPassword !== confirmPassword) {
      console.error('change-password: Password confirmation does not match');
      return new Response(
        JSON.stringify({ success: false, error: 'New password and confirmation do not match' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Update password using admin API
    console.log('change-password: Updating password for user:', user.id);
    
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('change-password: Failed to update password:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update password. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('change-password: Password changed successfully for user:', user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Password changed successfully' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('change-password: Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
