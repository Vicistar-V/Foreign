import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Create user client to get the calling user
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the calling user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Not authorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      console.error('User is not admin:', user.id);
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { action, userId, reason } = await req.json();

    if (!action || !userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: action and userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin ${user.id} performing ${action} on user ${userId}`);

    // Get the target user's profile
    const { data: targetProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('full_name, is_banned, banned_reason')
      .eq('id', userId)
      .single();

    if (profileError || !targetProfile) {
      console.error('Profile not found:', profileError);
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'ban') {
      // Validate reason for ban
      if (!reason || reason.trim() === '') {
        return new Response(
          JSON.stringify({ success: false, error: 'Ban reason is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if already banned
      if (targetProfile.is_banned) {
        return new Response(
          JSON.stringify({ success: false, error: 'User is already banned' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update profile to banned
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          is_banned: true,
          banned_reason: reason,
          banned_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Failed to ban user:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to ban user' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Queue notification to user
      const { error: notifyError } = await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: userId,
          notification_type: 'account_banned',
          title: 'Account Suspended',
          message: `Your account has been suspended. Reason: ${reason}`,
          metadata: {
            reason: reason,
            banned_by: 'admin',
            date: new Date().toISOString()
          }
        });

      if (notifyError) {
        console.error('Failed to queue notification:', notifyError);
        // Don't fail the request, just log it
      }

      // Log to system alerts for audit
      const { error: alertError } = await supabaseAdmin
        .from('system_alerts')
        .insert({
          alert_type: 'user_banned',
          severity: 'warning',
          message: `User ${targetProfile.full_name} was banned by admin`,
          metadata: {
            user_id: userId,
            user_name: targetProfile.full_name,
            reason: reason,
            admin_id: user.id,
            action: 'manual_ban'
          }
        });

      if (alertError) {
        console.error('Failed to log alert:', alertError);
      }

      // =====================================================
      // TELEGRAM ALERT - Notify admin of ban action (audit)
      // =====================================================
      try {
        console.log('[admin-ban-action] Sending Telegram alert for ban');
        
        await supabaseAdmin.functions.invoke('send-telegram-alert', {
          body: {
            alertType: 'user_banned',
            userName: targetProfile.full_name,
            userId: userId,
            banReason: reason
          }
        });
        
        console.log('[admin-ban-action] Telegram alert sent');
      } catch (telegramError) {
        // Non-blocking - don't fail the request if Telegram fails
        console.error('[admin-ban-action] Telegram alert failed:', telegramError);
      }

      console.log(`Successfully banned user ${userId}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: `${targetProfile.full_name} has been banned`,
          action: 'ban'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'unban') {
      // Check if user is actually banned
      if (!targetProfile.is_banned) {
        return new Response(
          JSON.stringify({ success: false, error: 'User is not banned' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update profile to unbanned
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          is_banned: false,
          banned_reason: null,
          banned_at: null
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Failed to unban user:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to restore access' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Queue notification to user
      const { error: notifyError } = await supabaseAdmin
        .from('event_queue')
        .insert({
          user_id: userId,
          event_type: 'account_unbanned',
          event_data: {
            date: new Date().toISOString(),
            message: 'Your account access has been restored'
          },
          status: 'pending'
        });

      if (notifyError) {
        console.error('Failed to queue notification:', notifyError);
      }

      // Log to system alerts for audit
      const { error: alertError } = await supabaseAdmin
        .from('system_alerts')
        .insert({
          alert_type: 'user_unbanned',
          severity: 'info',
          message: `User ${targetProfile.full_name} access was restored by admin`,
          metadata: {
            user_id: userId,
            user_name: targetProfile.full_name,
            previous_reason: targetProfile.banned_reason,
            admin_id: user.id,
            action: 'manual_unban'
          }
        });

      if (alertError) {
        console.error('Failed to log alert:', alertError);
      }

      // =====================================================
      // TELEGRAM ALERT - Notify admin of unban action (audit)
      // =====================================================
      try {
        console.log('[admin-ban-action] Sending Telegram alert for unban');
        
        await supabaseAdmin.functions.invoke('send-telegram-alert', {
          body: {
            alertType: 'user_unbanned',
            userName: targetProfile.full_name,
            userId: userId,
            previousBanReason: targetProfile.banned_reason
          }
        });
        
        console.log('[admin-ban-action] Telegram alert sent');
      } catch (telegramError) {
        // Non-blocking - don't fail the request if Telegram fails
        console.error('[admin-ban-action] Telegram alert failed:', telegramError);
      }

      console.log(`Successfully unbanned user ${userId}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: `${targetProfile.full_name}'s access has been restored`,
          action: 'unban'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid action. Use "ban" or "unban"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Admin ban action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
