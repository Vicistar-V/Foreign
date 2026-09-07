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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse query params
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const category = url.searchParams.get('category');
    const priority = url.searchParams.get('priority');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const search = url.searchParams.get('search');
    
    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    console.log(`[get-support-tickets] User ${user.id} is admin: ${isAdmin}`);

    // Build query
    let query = supabase
      .from('support_tickets')
      .select(`
        *,
        user:profiles!support_tickets_user_id_fkey(
          id,
          full_name,
          avatar_url,
          referral_code
        ),
        messages:ticket_messages(count),
        unread_count:ticket_messages(count)
      `, { count: 'exact' });

    // If not admin, only show user's own tickets
    if (!isAdmin) {
      query = query.eq('user_id', user.id);
    }

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    if (priority && priority !== 'all') {
      query = query.eq('priority', priority);
    }
    if (search) {
      query = query.ilike('subject', `%${search}%`);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: tickets, error: ticketsError, count } = await query;

    if (ticketsError) {
      console.error('[get-support-tickets] Error fetching tickets:', ticketsError);
      return new Response(
        JSON.stringify({ error: ticketsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get unread message counts for each ticket
    const ticketsWithUnread = await Promise.all(
      (tickets || []).map(async (ticket) => {
        // For users: count admin messages not read
        // For admins: count user messages not read
        const { count: unreadCount } = await supabase
          .from('ticket_messages')
          .select('*', { count: 'exact', head: true })
          .eq('ticket_id', ticket.id)
          .is('read_at', null)
          .neq('sender_type', isAdmin ? 'admin' : 'user');

        return {
          ...ticket,
          unread_count: unreadCount || 0,
          message_count: ticket.messages?.[0]?.count || 0
        };
      })
    );

    // Get summary stats (only for admins)
    let stats = null;
    if (isAdmin) {
      const { data: allTickets } = await supabase
        .from('support_tickets')
        .select('status, priority');

      stats = {
        total: allTickets?.length || 0,
        open: allTickets?.filter(t => t.status === 'open').length || 0,
        in_progress: allTickets?.filter(t => t.status === 'in_progress').length || 0,
        waiting_user: allTickets?.filter(t => t.status === 'waiting_user').length || 0,
        resolved: allTickets?.filter(t => t.status === 'resolved').length || 0,
        closed: allTickets?.filter(t => t.status === 'closed').length || 0,
        urgent: allTickets?.filter(t => t.priority === 'urgent' && t.status !== 'resolved' && t.status !== 'closed').length || 0,
      };
    }

    console.log(`[get-support-tickets] Returning ${ticketsWithUnread.length} tickets`);

    return new Response(
      JSON.stringify({
        tickets: ticketsWithUnread,
        total: count,
        page,
        limit,
        stats,
        isAdmin
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[get-support-tickets] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Something went wrong' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
