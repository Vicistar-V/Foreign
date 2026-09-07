import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Not authorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: adminUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !adminUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: adminUser.id, _role: 'admin' });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const body = await req.json();
    const { action, userId, pin, ...actionData } = body;

    if (!action || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing action or userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin PIN
    if (!pin) {
      return new Response(
        JSON.stringify({ error: 'PIN verification required for admin actions' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin PIN through the single bcrypt-backed verifier.
    const { data: pinResponse, error: pinError } = await supabase.functions.invoke('verify-pin', {
      body: { pin },
      headers: { Authorization: authHeader },
    });

    if (pinError || !pinResponse?.valid) {
      return new Response(
        JSON.stringify({ error: pinResponse?.error || 'Invalid PIN' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get target user's current profile for audit logging
    const { data: targetProfile, error: targetError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (targetError || !targetProfile) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: any = { success: true };
    let auditLog: any = {
      admin_id: adminUser.id,
      target_user_id: userId,
      action,
      timestamp: new Date().toISOString(),
    };

    console.log(`[admin-edit-profile] Admin ${adminUser.id} performing ${action} on user ${userId}`);

    // Handle different actions
    switch (action) {
      case 'update_name': {
        const { newName } = actionData;
        if (!newName || newName.trim().length < 2) {
          return new Response(
            JSON.stringify({ error: 'Name must be at least 2 characters' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ full_name: newName.trim() })
          .eq('id', userId);

        if (updateError) throw updateError;

        auditLog.old_value = targetProfile.full_name;
        auditLog.new_value = newName.trim();
        result.message = `Name updated from "${targetProfile.full_name}" to "${newName.trim()}"`;
        break;
      }

      case 'update_phone': {
        const { newPhone } = actionData;
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ phone_number: newPhone?.trim() || null })
          .eq('id', userId);

        if (updateError) throw updateError;

        auditLog.old_value = targetProfile.phone_number;
        auditLog.new_value = newPhone?.trim() || null;
        result.message = `Phone number updated`;
        break;
      }

      case 'toggle_name_lock': {
        const newLockStatus = !targetProfile.is_name_locked;
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ is_name_locked: newLockStatus })
          .eq('id', userId);

        if (updateError) throw updateError;

        auditLog.old_value = targetProfile.is_name_locked;
        auditLog.new_value = newLockStatus;
        result.message = newLockStatus ? 'Name has been locked' : 'Name has been unlocked';
        result.is_name_locked = newLockStatus;
        break;
      }

      case 'reset_pin': {
        // PINs live in user_pin_secrets (bcrypt). Also clear legacy profiles.pin_hash.
        const { error: secretErr } = await supabase
          .from('user_pin_secrets')
          .delete()
          .eq('user_id', userId);
        if (secretErr) throw secretErr;

        // Legacy column — best-effort, ignore trigger blocks
        await supabase.from('profiles').update({ pin_hash: null }).eq('id', userId);

        auditLog.old_value = 'PIN was set';
        auditLog.new_value = 'PIN cleared';
        result.message = 'User PIN has been reset. They will be asked to create a new PIN next time they sign in.';
        break;
      }

      case 'force_verify_email': {
        // Use admin API to update email confirmation
        const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
          email_confirm: true
        });

        if (updateError) throw updateError;

        auditLog.old_value = 'Email not verified';
        auditLog.new_value = 'Email verified by admin';
        result.message = 'Email has been marked as verified';
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Log the action to system_alerts for audit trail
    await supabase.from('system_alerts').insert({
      alert_type: 'admin_profile_edit',
      severity: 'info',
      message: `Admin edited user profile: ${action}`,
      metadata: auditLog,
      acknowledged_at: new Date().toISOString(), // Auto-acknowledge since it's just a log
      acknowledged_by: adminUser.id
    });

    console.log(`[admin-edit-profile] Action ${action} completed successfully`, auditLog);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[admin-edit-profile] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
