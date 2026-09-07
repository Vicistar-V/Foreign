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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id, _role: 'admin',
    });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin only' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'list';

    // Fetch all admin_broadcast notifications (paged in if many)
    const { data: rows, error } = await supabase
      .from('notifications')
      .select('id, user_id, title, message, metadata, read_at, created_at')
      .eq('notification_type', 'admin_broadcast')
      .eq('metadata->>sent_by_admin', 'true')
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error) throw error;

    type Row = typeof rows[0];
    // Group by broadcast_id if present, else by (title + sent_at)
    const groups = new Map<string, { key: string; title: string; message: string; sent_at: string; audience: string | null; show_as_modal: boolean; icon_template?: string; cta_button_text?: string; cta_button_link?: string; rows: Row[] }>();
    for (const r of rows || []) {
      const m: any = r.metadata || {};
      const key = m.broadcast_id || `${r.title}::${m.sent_at || r.created_at}`;
      let g = groups.get(key);
      if (!g) {
        g = {
          key,
          title: r.title,
          message: r.message,
          sent_at: m.sent_at || r.created_at,
          audience: m.audience || null,
          show_as_modal: !!m.show_as_modal,
          icon_template: m.icon_template,
          cta_button_text: m.cta_button_text,
          cta_button_link: m.cta_button_link,
          rows: [],
        };
        groups.set(key, g);
      }
      g.rows.push(r);
    }

    const summarize = (g: any) => {
      const recipients = g.rows.length;
      const read = g.rows.filter((r: Row) => r.read_at).length;
      const dismissed = g.rows.filter((r: Row) => (r.metadata as any)?.modal_dismissed_at).length;
      const clickers = g.rows.filter((r: Row) => Number((r.metadata as any)?.cta_click_count || 0) > 0).length;
      const totalClicks = g.rows.reduce((s: number, r: Row) => s + Number((r.metadata as any)?.cta_click_count || 0), 0);
      return {
        id: g.key,
        title: g.title,
        message: g.message,
        sent_at: g.sent_at,
        audience: g.audience,
        show_as_modal: g.show_as_modal,
        icon_template: g.icon_template,
        cta_button_text: g.cta_button_text,
        cta_button_link: g.cta_button_link,
        recipients,
        read_count: read,
        modal_seen_count: dismissed,
        cta_clickers: clickers,
        cta_total_clicks: totalClicks,
        read_rate: recipients ? Math.round((read / recipients) * 100) : 0,
        seen_rate: recipients ? Math.round((dismissed / recipients) * 100) : 0,
        click_rate: recipients ? Math.round((clickers / recipients) * 100) : 0,
      };
    };

    if (action === 'detail') {
      const id = body.broadcast_id as string;
      const g = groups.get(id);
      if (!g) {
        return new Response(JSON.stringify({ success: false, error: 'Not found' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Pull recipient names
      const userIds = g.rows.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, is_member')
        .in('id', userIds.slice(0, 1000));
      const pmap = new Map((profiles || []).map(p => [p.id, p]));

      const recipients = g.rows.slice(0, 1000).map(r => {
        const p = pmap.get(r.user_id) as any;
        const md: any = r.metadata || {};
        return {
          user_id: r.user_id,
          full_name: p?.full_name || 'Unknown',
          avatar_url: p?.avatar_url || null,
          is_member: !!p?.is_member,
          delivered_at: r.created_at,
          read_at: r.read_at,
          modal_seen_at: md.modal_dismissed_at || null,
          cta_click_count: Number(md.cta_click_count || 0),
          cta_first_clicked_at: md.cta_first_clicked_at || null,
          cta_last_clicked_at: md.cta_last_clicked_at || null,
        };
      });

      return new Response(JSON.stringify({
        success: true,
        broadcast: summarize(g),
        recipients,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // list
    const broadcasts = Array.from(groups.values())
      .map(summarize)
      .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());

    return new Response(JSON.stringify({ success: true, broadcasts }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message || 'Error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
