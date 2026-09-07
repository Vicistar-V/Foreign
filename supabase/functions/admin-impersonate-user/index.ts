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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: admin }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !admin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: admin.id,
      _role: 'admin',
    });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Access denied. Admin role required.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId: string | undefined = body?.userId;
    const redirectTo: string = body?.redirectTo || '/dashboard';
    const callerOrigin: string | undefined = body?.origin;

    if (!targetUserId || typeof targetUserId !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'userId is required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (targetUserId === admin.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'You cannot impersonate yourself' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the target user's email
    const { data: target, error: targetError } = await supabase.auth.admin.getUserById(targetUserId);
    if (targetError || !target?.user?.email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Target user not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Block impersonating other admins (safety)
    const { data: targetIsAdmin } = await supabase.rpc('has_role', {
      _user_id: targetUserId,
      _role: 'admin',
    });
    if (targetIsAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: 'You cannot impersonate another admin' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve the caller's origin dynamically.
    // Priority: explicit body.origin (most reliable) → Origin header → Referer header.
    const headerOrigin = req.headers.get('origin') || '';
    const referer = req.headers.get('referer') || '';
    let resolvedOrigin = '';
    const tryOrigin = (val: string) => {
      try {
        const u = new URL(val);
        // Reject localhost-ish values when a non-localhost alternative exists.
        return `${u.protocol}//${u.host}`;
      } catch (_) { return ''; }
    };
    resolvedOrigin =
      tryOrigin(callerOrigin || '') ||
      tryOrigin(headerOrigin) ||
      tryOrigin(referer);

    const path = redirectTo.startsWith('/') ? redirectTo : '/' + redirectTo;
    const sep = path.includes('?') ? '&' : '?';
    const pathWithFlag = `${path}${sep}impersonated=1`;
    const redirectAbs = resolvedOrigin
      ? `${resolvedOrigin}${pathWithFlag}`
      : pathWithFlag;

    // Generate magic link (admin session in browser is untouched; link opened in new tab signs in as target)
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: target.user.email,
      options: { redirectTo: redirectAbs },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('generateLink error:', linkError);
      return new Response(
        JSON.stringify({ success: false, error: linkError?.message || 'Failed to create login link' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Defensive rewrite: if Supabase falls back to its Site URL (e.g. http://localhost:3000)
    // because our redirect isn't in the allow list, force the redirect_to back to the
    // caller's real origin so the magic link lands on the correct domain.
    let actionLink: string = linkData.properties.action_link;
    if (resolvedOrigin) {
      try {
        const linkUrl = new URL(actionLink);
        const rt = linkUrl.searchParams.get('redirect_to');
        if (rt) {
          try {
            const rtUrl = new URL(rt);
            if (`${rtUrl.protocol}//${rtUrl.host}` !== resolvedOrigin) {
              const fixed = `${resolvedOrigin}${rtUrl.pathname}${rtUrl.search}${rtUrl.hash}`;
              linkUrl.searchParams.set('redirect_to', fixed);
              actionLink = linkUrl.toString();
            }
          } catch (_) {
            // redirect_to was relative; make it absolute on resolvedOrigin
            const rel = rt.startsWith('/') ? rt : '/' + rt;
            linkUrl.searchParams.set('redirect_to', `${resolvedOrigin}${rel}`);
            actionLink = linkUrl.toString();
          }
        }
      } catch (e) {
        console.error('Failed to rewrite action_link redirect_to:', e);
      }
    }


    // Get admin profile for audit
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', admin.id)
      .single();

    // Audit log to admin_notifications
    await supabase.from('admin_notifications').insert({
      notification_type: 'admin_impersonation',
      title: 'Admin viewed as user',
      message: `${adminProfile?.full_name || 'Admin'} logged in as ${target.user.email}`,
      metadata: {
        admin_id: admin.id,
        admin_email: admin.email,
        target_user_id: targetUserId,
        target_email: target.user.email,
        at: new Date().toISOString(),
      },
      link: `/admin/users/${targetUserId}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        action_link: actionLink,
        target_email: target.user.email,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('admin-impersonate-user error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
