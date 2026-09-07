import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  title: string;
  message: string;
  audience: 'all' | 'members' | 'non_members' | 'manual';
  user_ids?: string[];
  // Modal popup options
  show_as_modal?: boolean;
  icon_template?: 'megaphone' | 'gift' | 'trophy' | 'rocket' | 'heart' | 'star' | 'bell' | 'info';
  cta_button_text?: string;
  cta_button_link?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Verify user is admin
    const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });

    if (roleError || !isAdmin) {
      console.error('Admin check failed:', roleError);
      return new Response(
        JSON.stringify({ success: false, error: 'Access denied. Admin role required.', errorCode: 'ACCESS_DENIED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      title, 
      message, 
      audience, 
      user_ids,
      show_as_modal,
      icon_template,
      cta_button_text,
      cta_button_link
    }: RequestBody = await req.json();

    console.log('send-admin-notification: Processing request', { 
      title, 
      audience, 
      manual_count: user_ids?.length,
      show_as_modal,
      icon_template,
      has_cta: !!cta_button_text
    });

    // Validate input
    if (!title || !message) {
      throw new Error('Title and message are required');
    }

    if (!['all', 'members', 'non_members', 'manual'].includes(audience)) {
      throw new Error('Invalid audience type');
    }

    if (audience === 'manual' && (!user_ids || user_ids.length === 0)) {
      throw new Error('user_ids required for manual audience selection');
    }

    // Get target user IDs based on audience
    let targetUserIds: string[] = [];

    if (audience === 'all') {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_banned', false);
      
      if (error) throw error;
      targetUserIds = profiles.map(p => p.id);
    } else if (audience === 'members') {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_member', true)
        .eq('is_banned', false);
      
      if (error) throw error;
      targetUserIds = profiles.map(p => p.id);
    } else if (audience === 'non_members') {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_member', false)
        .eq('is_banned', false);
      
      if (error) throw error;
      targetUserIds = profiles.map(p => p.id);
    } else if (audience === 'manual') {
      targetUserIds = user_ids!;
    }

    if (targetUserIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent_count: 0, message: 'No users found for selected audience' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`send-admin-notification: Sending to ${targetUserIds.length} users`);

    // Build metadata for modal notifications
    const broadcastId = crypto.randomUUID();
    const sentAt = new Date().toISOString();
    const metadata: Record<string, any> = {
      sent_by_admin: true,
      sent_by: user.id,
      sent_at: sentAt,
      audience,
      broadcast_id: broadcastId,
    };

    // Add modal-specific fields if show_as_modal is enabled
    if (show_as_modal) {
      metadata.show_as_modal = true;
      metadata.modal_dismissed_at = null; // Will be set when user dismisses
      
      if (icon_template) {
        metadata.icon_template = icon_template;
      }
      
      if (cta_button_text && cta_button_link) {
        metadata.cta_button_text = cta_button_text;
        metadata.cta_button_link = cta_button_link;
      }
    }

    // Create notification records directly in the notifications table
    const notifications = targetUserIds.map(userId => ({
      user_id: userId,
      notification_type: 'admin_broadcast',
      title,
      message,
      metadata,
    }));

    // Insert all notifications in batch
    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (insertError) {
      console.error('send-admin-notification: Insert error', insertError);
      throw insertError;
    }

    console.log(`send-admin-notification: Successfully sent to ${targetUserIds.length} users`);

    return new Response(
      JSON.stringify({
        success: true,
        sent_count: targetUserIds.length,
        message: `Notification sent to ${targetUserIds.length} users`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('send-admin-notification error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, errorCode: 'VALIDATION_ERROR' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
