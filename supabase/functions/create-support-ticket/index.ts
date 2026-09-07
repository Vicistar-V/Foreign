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
    const { subject, category, message } = await req.json();

    // Validate inputs
    if (!subject || !subject.trim()) {
      return new Response(
        JSON.stringify({ error: 'Please tell us what this is about' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!message || !message.trim()) {
      return new Response(
        JSON.stringify({ error: 'Please describe your issue' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validCategories = ['money_issue', 'account_problem', 'how_to_use', 'complaint', 'suggestion', 'other'];
    const ticketCategory = validCategories.includes(category) ? category : 'other';

    console.log(`[create-support-ticket] Creating ticket for user ${user.id}: ${subject}`);

    // Create the ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .insert({
        user_id: user.id,
        subject: subject.trim(),
        category: ticketCategory,
        status: 'open',
        priority: 'normal'
      })
      .select()
      .single();

    if (ticketError) {
      console.error('[create-support-ticket] Error creating ticket:', ticketError);
      return new Response(
        JSON.stringify({ error: 'Failed to create help request' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add the initial message
    const { data: firstMessage, error: messageError } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticket.id,
        sender_id: user.id,
        sender_type: 'user',
        message: message.trim(),
        image_url: null
      })
      .select()
      .single();

    if (messageError) {
      console.error('[create-support-ticket] Error adding message:', messageError);
      // Don't fail the whole request, ticket was created
    }

    // Fire-and-forget: ask the AI helper to respond to this FIRST message.
    // Without this the user creates a ticket and waits forever on the intro.
    if (firstMessage?.id) {
      supabase.functions
        .invoke('ai-support-responder', {
          body: { ticket_id: ticket.id, last_message_id: firstMessage.id },
        })
        .then((r) => console.log('[create-support-ticket] AI responder kicked:', r?.error ? 'err' : 'ok'))
        .catch((e) => console.error('[create-support-ticket] AI responder kick failed', e));
    }

    // Create notification for the user (confirmation)
    await supabase.from('notifications').insert({
      user_id: user.id,
      notification_type: 'ticket_created',
      title: 'Help Request Sent',
      message: `Your request "${subject.trim()}" has been received. We'll get back to you soon!`,
      metadata: { ticket_id: ticket.id, subject: subject.trim(), category: ticketCategory },
      link: '/support'
    });

    // =====================================================
    // IN-APP ADMIN NOTIFICATION - Add system alert
    // =====================================================
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('full_name, is_member, phone_number')
      .eq('id', user.id)
      .single();

    // Create admin notification (new system)
    await supabase.from('admin_notifications').insert({
      notification_type: 'new_ticket',
      title: 'New Support Ticket',
      message: `${userProfile?.full_name || 'User'}: "${subject.trim()}"`,
      metadata: {
        ticket_id: ticket.id,
        user_id: user.id,
        user_name: userProfile?.full_name || 'Unknown',
        category: ticketCategory,
        message_preview: message.trim().substring(0, 100),
        is_member: userProfile?.is_member || false
      },
      link: '/admin/support'
    });

    console.log('[create-support-ticket] Admin notification created');

    // =====================================================
    // ADMIN EMAIL ALERT - Notify admin of new ticket
    // =====================================================
    // Email alerts handled by notification-worker if needed

    // =====================================================
    // TELEGRAM ALERT - Notify admin instantly
    // =====================================================
    try {
      console.log('[create-support-ticket] Sending Telegram alert');
      
      // Get user profile info for Telegram alert
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, phone_number, is_member')
        .eq('id', user.id)
        .single();
      
      await supabase.functions.invoke('send-telegram-alert', {
        body: {
          alertType: 'new_ticket',
          userName: profileData?.full_name || 'Unknown',
          userPhone: profileData?.phone_number || 'Not provided',
          userEmail: user.email,
          ticketId: ticket.id,
          ticketSubject: subject.trim(),
          ticketCategory: ticketCategory,
          messagePreview: message.trim(),
          isMember: profileData?.is_member || false
        }
      });
      
      console.log('[create-support-ticket] Telegram alert sent');
    } catch (telegramError) {
      // Non-blocking - don't fail the request if Telegram fails
      console.error('[create-support-ticket] Telegram alert failed:', telegramError);
    }

    console.log(`[create-support-ticket] Ticket ${ticket.id} created successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        ticket_id: ticket.id,
        message: 'Your help request has been sent! We will get back to you soon.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[create-support-ticket] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Something went wrong' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
