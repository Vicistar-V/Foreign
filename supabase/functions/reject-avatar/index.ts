import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  userId: string;
  reason: string;
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
        JSON.stringify({ success: false, error: 'Access denied. Admin role required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, reason }: RequestBody = await req.json();

    console.log('reject-avatar: Processing rejection', { userId, reason, adminId: user.id });

    // Validate input
    if (!userId || !reason) {
      throw new Error('userId and reason are required');
    }

    // Get the user's current avatar_url
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('avatar_url, full_name')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('reject-avatar: Profile fetch error', profileError);
      throw new Error('User not found');
    }

    if (!profile.avatar_url) {
      return new Response(
        JSON.stringify({ success: false, error: 'User has no avatar to reject' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('reject-avatar: Found avatar', { avatar_url: profile.avatar_url });

    // Extract the file path from the avatar URL
    // Format: https://[project].supabase.co/storage/v1/object/public/avatars/[user_id]/[filename]
    const urlParts = profile.avatar_url.split('/avatars/');
    if (urlParts.length < 2) {
      console.error('reject-avatar: Invalid avatar URL format', profile.avatar_url);
      throw new Error('Invalid avatar URL format');
    }
    const filePath = urlParts[1];

    console.log('reject-avatar: Deleting file', { filePath });

    // Delete the avatar file from storage
    const { error: deleteError } = await supabase.storage
      .from('avatars')
      .remove([filePath]);

    if (deleteError) {
      console.error('reject-avatar: Storage delete error', deleteError);
      // Continue even if deletion fails - we still want to clear the URL
    }

    // Clear avatar_url in profiles table
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', userId);

    if (updateError) {
      console.error('reject-avatar: Profile update error', updateError);
      throw updateError;
    }

    // Send notification to user
    const { error: notifError } = await supabase
      .from('event_queue')
      .insert({
        user_id: userId,
        event_type: 'admin_message',
        event_data: {
          title: '📷 Profile Picture Removed',
          message: `Your profile picture was removed because it doesn't meet our requirements.\n\nReason: ${reason}\n\nPlease upload a real photo of yourself. Using other images is against our terms and may result in account suspension.\n\nYou'll be asked to add a new photo when you reload the app.`,
          rejection_reason: reason,
          rejected_by: user.id,
          rejected_at: new Date().toISOString(),
          action_type: 'avatar_rejected',
        },
        status: 'completed',
      });

    if (notifError) {
      console.error('reject-avatar: Notification error', notifError);
      // Don't throw - avatar was already removed successfully
    }

    console.log('reject-avatar: Successfully rejected avatar for', profile.full_name);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Avatar removed for ${profile.full_name}. User will be notified.`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('reject-avatar error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
