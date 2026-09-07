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

    // Parse request body
    const { ticket_id, message, image_url } = await req.json();

    if (!ticket_id) {
      return new Response(
        JSON.stringify({ error: 'Missing ticket ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if ((!message || !message.trim()) && !image_url) {
      return new Response(
        JSON.stringify({ error: 'Please enter a message or attach an image' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    // Get the ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticket_id)
      .single();

    if (ticketError || !ticket) {
      console.error('[add-ticket-message] Ticket not found:', ticketError);
      return new Response(
        JSON.stringify({ error: 'Help request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check authorization
    if (!isAdmin && ticket.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'You can only reply to your own help requests' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if ticket is closed
    if (ticket.status === 'closed') {
      return new Response(
        JSON.stringify({ error: 'This help request is closed. Please open a new one.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const senderType = isAdmin ? 'admin' : 'user';

    console.log(`[add-ticket-message] Adding ${senderType} message to ticket ${ticket_id}`);

    // Add the message
    const { data: newMessage, error: messageError } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticket_id,
        sender_id: user.id,
        sender_type: senderType,
        message: (message || '').trim(),
        image_url: image_url || null
      })
      .select()
      .single();

    if (messageError) {
      console.error('[add-ticket-message] Error adding message:', messageError);
      return new Response(
        JSON.stringify({ error: 'Failed to send message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update ticket status based on who replied
    let newStatus = ticket.status;
    if (senderType === 'admin') {
      // Admin replied - waiting for user
      if (ticket.status === 'open') {
        newStatus = 'in_progress';
      }
    } else {
      // User replied - back to open if it was waiting for them
      if (ticket.status === 'waiting_user') {
        newStatus = 'open';
      }
    }

    if (newStatus !== ticket.status) {
      await supabase
        .from('support_tickets')
        .update({ status: newStatus })
        .eq('id', ticket_id);
    }

    // Mark previous messages as read
    await supabase
      .from('ticket_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('ticket_id', ticket_id)
      .neq('sender_type', senderType)
      .is('read_at', null);

    // Queue notification
    if (senderType === 'admin') {
      // Notify the user that admin replied
      await supabase.from('notifications').insert({
        user_id: ticket.user_id,
        notification_type: 'ticket_reply',
        title: 'Support Replied',
        message: message.trim().substring(0, 100),
        metadata: { ticket_id: ticket.id, subject: ticket.subject },
        link: '/support'
      });
    } else {
      // User replied - create admin notification
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, phone_number')
        .eq('id', user.id)
        .single();
      
      await supabase.from('admin_notifications').insert({
        notification_type: 'user_reply_on_ticket',
        title: 'User Replied',
        message: `${profileData?.full_name || 'User'} replied to "${ticket.subject}"`,
        metadata: {
          ticket_id: ticket.id,
          user_id: user.id,
          user_name: profileData?.full_name || 'Unknown',
          message_preview: message.trim().substring(0, 100)
        },
        link: '/admin/support'
      });
      
      console.log('[add-ticket-message] Admin notification created');

      // Telegram alert for user reply
      try {
        console.log('[add-ticket-message] Sending Telegram alert for user reply');
        
        await supabase.functions.invoke('send-telegram-alert', {
          body: {
            alertType: 'ticket_reply',
            userName: profileData?.full_name || 'Unknown',
            userPhone: profileData?.phone_number || 'Not provided',
            ticketId: ticket.id,
            ticketSubject: ticket.subject,
            messagePreview: message.trim()
          }
        });
        
        console.log('[add-ticket-message] Telegram alert sent');
      } catch (telegramError) {
        console.error('[add-ticket-message] Telegram alert failed:', telegramError);
      }
    }

    // Fire-and-forget: ask the AI helper to respond to user messages.
    // We pass last_message_id so the responder can detect stale triggers
    // and abort cleanly if a newer user message arrives mid-generation.
    if (senderType === 'user' && ticket.status !== 'closed') {
      supabase.functions
        .invoke('ai-support-responder', {
          body: { ticket_id: ticket_id, last_message_id: newMessage.id },
        })
        .then((r) => console.log('[add-ticket-message] AI responder kicked:', r?.error ? 'err' : 'ok'))
        .catch((e) => console.error('[add-ticket-message] AI responder kick failed', e));
    }

    console.log(`[add-ticket-message] Message added successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        message: newMessage
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[add-ticket-message] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Something went wrong' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
