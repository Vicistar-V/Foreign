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

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { ticket_id, status, priority } = await req.json();

    if (!ticket_id) {
      return new Response(
        JSON.stringify({ error: 'Missing ticket ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the current ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticket_id)
      .single();

    if (ticketError || !ticket) {
      console.error('[update-ticket-status] Ticket not found:', ticketError);
      return new Response(
        JSON.stringify({ error: 'Help request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    
    const validStatuses = ['open', 'in_progress', 'waiting_user', 'resolved', 'closed'];
    if (status && validStatuses.includes(status)) {
      updateData.status = status;
      
      // If resolved or closed, set resolved_at and resolved_by
      if (status === 'resolved' || status === 'closed') {
        if (!ticket.resolved_at) {
          updateData.resolved_at = new Date().toISOString();
          updateData.resolved_by = user.id;
        }
      } else {
        // If reopening, clear resolved fields
        if (ticket.resolved_at) {
          updateData.resolved_at = null;
          updateData.resolved_by = null;
        }
      }
    }

    const validPriorities = ['normal', 'urgent'];
    if (priority && validPriorities.includes(priority)) {
      updateData.priority = priority;
    }

    if (Object.keys(updateData).length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nothing to update' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[update-ticket-status] Updating ticket ${ticket_id}:`, updateData);

    // Update the ticket
    const { error: updateError } = await supabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', ticket_id);

    if (updateError) {
      console.error('[update-ticket-status] Error updating ticket:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update help request' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Notify user if resolved
    if (status === 'resolved') {
      await supabase
        .from('notifications')
        .insert({
          user_id: ticket.user_id,
          notification_type: 'ticket_resolved',
          title: 'Your Support Ticket Has Been Resolved',
          message: `Your ticket "${ticket.subject}" has been resolved. Tap to view details.`,
          metadata: {
            ticket_id: ticket.id,
            subject: ticket.subject
          },
          link: '/support'
        });
    }

    console.log(`[update-ticket-status] Ticket ${ticket_id} updated successfully`);

    // Get status labels for response
    const statusLabels: Record<string, string> = {
      'open': 'Waiting for Help',
      'in_progress': 'Someone is Helping',
      'waiting_user': 'We Need Your Reply',
      'resolved': 'Problem Solved',
      'closed': 'Done'
    };

    return new Response(
      JSON.stringify({
        success: true,
        message: status ? `Status changed to "${statusLabels[status] || status}"` : 'Updated successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[update-ticket-status] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Something went wrong' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
