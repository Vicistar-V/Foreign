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

    // Get ticket_id from URL params
    const url = new URL(req.url);
    const ticketId = url.searchParams.get('ticket_id');

    if (!ticketId) {
      return new Response(
        JSON.stringify({ error: 'Missing ticket ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    console.log(`[get-ticket-detail] Getting ticket ${ticketId} for user ${user.id} (admin: ${isAdmin})`);

    // Get the ticket with user info
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select(`
        *,
        user:profiles!support_tickets_user_id_fkey(
          id,
          full_name,
          avatar_url,
          referral_code,
          is_member,
          is_banned,
          created_at
        ),
        resolver:profiles!support_tickets_resolved_by_fkey(
          id,
          full_name
        )
      `)
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      console.error('[get-ticket-detail] Ticket not found:', ticketError);
      return new Response(
        JSON.stringify({ error: 'Help request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check authorization
    if (!isAdmin && ticket.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'You can only view your own help requests' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all messages with sender info
    const { data: messages, error: messagesError } = await supabase
      .from('ticket_messages')
      .select(`
        *,
        sender:profiles!ticket_messages_sender_id_fkey(
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('[get-ticket-detail] Error fetching messages:', messagesError);
    }

    // Mark messages as read (those from the other party)
    const myType = isAdmin ? 'admin' : 'user';
    await supabase
      .from('ticket_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('ticket_id', ticketId)
      .neq('sender_type', myType)
      .is('read_at', null);

    console.log(`[get-ticket-detail] Returning ticket with ${messages?.length || 0} messages`);

    return new Response(
      JSON.stringify({
        ticket,
        messages: messages || [],
        isAdmin
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[get-ticket-detail] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Something went wrong' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
