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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role
    const { data: hasAdminRole } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });

    if (!hasAdminRole) {
      return new Response(
        JSON.stringify({ success: false, error: 'Access denied. Admin role required.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { maintenanceMode } = await req.json();

    if (typeof maintenanceMode !== 'boolean') {
      return new Response(
        JSON.stringify({ success: false, error: 'maintenanceMode must be a boolean' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current value for the Telegram alert
    const { data: currentConfig } = await supabase
      .from('platform_config')
      .select('maintenance_mode')
      .eq('id', 1)
      .single();
    
    const oldValue = currentConfig?.maintenance_mode;

    console.log(`toggle-maintenance: Setting maintenance from ${oldValue} to ${maintenanceMode ? 'ON' : 'OFF'}`);

    // Update platform config
    const { error: updateError } = await supabase
      .from('platform_config')
      .update({ maintenance_mode: maintenanceMode })
      .eq('id', 1);

    if (updateError) {
      console.error('toggle-maintenance: Update error:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update maintenance mode' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('toggle-maintenance: Success');

    // =====================================================
    // SEND TELEGRAM ALERT FOR CONFIG CHANGE
    // =====================================================
    try {
      // Get admin name for the alert
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      
      const adminName = adminProfile?.full_name || 'Admin';
      
      console.log(`📤 Sending maintenance mode change alert to Telegram...`);
      
      await supabase.functions.invoke('send-telegram-alert', {
        body: {
          alertType: 'config_changed',
          settingName: 'Maintenance Mode',
          oldValue: oldValue,
          newValue: maintenanceMode,
          adminName: adminName
        }
      });
      
      console.log('✅ Maintenance mode change alert sent');
    } catch (telegramError) {
      // Non-blocking - don't fail the main operation
      console.error('⚠️ Failed to send Telegram alert:', telegramError);
    }

    return new Response(
      JSON.stringify({ success: true, newStatus: maintenanceMode }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('toggle-maintenance: Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
