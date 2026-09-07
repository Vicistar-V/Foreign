import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UploadAvatarRequest {
  imageData: string;
  fileName: string;
  targetUserId?: string; // admin-only: upload on behalf of another user
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) throw new Error('Missing authorization header');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: UploadAvatarRequest = await req.json();
    const { imageData, fileName, targetUserId } = body;

    if (!imageData || !fileName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing image data or file name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine effective target user. If targetUserId differs from caller, require admin.
    let effectiveUserId = user.id;
    let actingAsAdmin = false;
    if (targetUserId && targetUserId !== user.id) {
      const { data: isAdmin } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin',
      });
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Admin only' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      effectiveUserId = targetUserId;
      actingAsAdmin = true;
    }

    console.log(`[upload-avatar] Uploading for user ${effectiveUserId} (admin=${actingAsAdmin})`);

    const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (!extension || !validExtensions.includes(extension)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid file type. Please use JPG, PNG, or WEBP' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const base64Data = imageData.includes('base64,')
      ? imageData.split('base64,')[1]
      : imageData;
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    if (binaryData.length > 2 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ success: false, error: 'Image too large. Maximum size is 2MB' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url, full_name')
      .eq('id', effectiveUserId)
      .single();

    if (profile?.avatar_url) {
      const oldPath = profile.avatar_url.split('/storage/v1/object/public/avatars/')[1]?.split('?')[0];
      if (oldPath) await supabase.storage.from('avatars').remove([oldPath]);
    }

    const filePath = `${effectiveUserId}/avatar.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, binaryData, {
        contentType: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
        upsert: true,
      });

    if (uploadError) {
      console.error('[upload-avatar] Upload error:', uploadError);
      return new Response(
        JSON.stringify({ success: false, error: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);
    const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', effectiveUserId);

    if (updateError) {
      console.error('[upload-avatar] Profile update error:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (actingAsAdmin) {
      await supabase.from('event_queue').insert({
        user_id: effectiveUserId,
        event_type: 'admin_message',
        event_data: {
          title: 'Profile Picture Added',
          message: 'An admin added a profile picture to your account so you can continue using the app.',
          action_type: 'avatar_set_by_admin',
          set_by: user.id,
          set_at: new Date().toISOString(),
        },
        status: 'completed',
      }).then(() => {}, () => {});
    }

    return new Response(
      JSON.stringify({
        success: true,
        avatar_url: avatarUrl,
        message: actingAsAdmin
          ? `Photo set for ${profile?.full_name ?? 'user'}.`
          : 'Profile picture uploaded successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[upload-avatar] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
