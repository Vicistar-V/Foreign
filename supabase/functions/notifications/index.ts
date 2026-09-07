import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { action, limit = 20, offset = 0, notification_ids, notification_id, filter = 'all' } = await req.json();

    // Map filter category → notification_type values
    const FILTER_TYPES: Record<string, string[]> = {
      wins: ['winner_alert', 'cycle_complete'],
      money: ['refund_notice', 'withdrawal_complete', 'deposit', 'membership_bonus', 'cycle_joined'],
      alerts: ['debt_warning', 'chargeback_alert', 'account_banned', 'admin_message', 'distribution_failed', 'withdrawal_failed'],
      support: ['ticket_created', 'ticket_reply', 'ticket_resolved'],
    };

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    switch (action) {
      case 'get': {
        console.log(`[notifications] Fetching for user ${user.id}, filter: ${filter}, limit: ${limit}, offset: ${offset}`);

        const filterTypes = FILTER_TYPES[filter];
        const isUnreadFilter = filter === 'unread';

        // Build user-notifications query with server-side filter
        let userQ = supabase
          .from('notifications')
          .select('*', { count: 'exact' })
          .eq('user_id', user.id);

        if (filterTypes) userQ = userQ.in('notification_type', filterTypes);
        if (isUnreadFilter) userQ = userQ.is('read_at', null);

        userQ = userQ
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        const { data: userNotifications, error: userNotifError, count: filteredCount } = await userQ;

        if (userNotifError) {
          console.error('[notifications] Error fetching user notifications:', userNotifError);
          throw userNotifError;
        }

        // Counts for stats (cheap head-only queries)
        const [totalRes, unreadRes] = await Promise.all([
          supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id),
          supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .is('read_at', null),
        ]);

        const notifications = (userNotifications || []).map(n => ({
          id: n.id,
          source: 'notification' as const,
          event_type: n.notification_type,
          title: n.title,
          message: n.message,
          event_data: {
            title: n.title,
            message: n.message,
            link: n.link,
            ...(n.metadata || {}),
          },
          created_at: n.created_at,
          read_at: n.read_at,
        }));

        // Admins ALSO see admin notifications appended on first page (kept simple)
        let adminNotifications: any[] = [];
        if (isAdmin && offset === 0 && !filterTypes && !isUnreadFilter) {
          const { data: adminNotifs } = await supabase
            .from('admin_notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

          if (adminNotifs) {
            adminNotifications = adminNotifs.map(n => {
              const readBy = n.read_by || [];
              const isRead = readBy.includes(user.id);
              return {
                id: n.id,
                source: 'admin_notification' as const,
                event_type: n.notification_type,
                title: n.title,
                message: n.message,
                event_data: {
                  title: n.title,
                  message: n.message,
                  link: n.link,
                  ...(n.metadata || {}),
                },
                created_at: n.created_at,
                read_at: isRead ? new Date().toISOString() : null,
              };
            });
          }
        }

        // Merge & re-sort just the current page
        const merged = [...notifications, ...adminNotifications]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const totalUnread = unreadRes.count || 0;
        const totalAll = totalRes.count || 0;
        const filteredTotal = filteredCount || 0;
        const hasMore = offset + limit < (isUnreadFilter ? totalUnread : (filterTypes ? filteredTotal : totalAll));

        return new Response(
          JSON.stringify({
            success: true,
            notifications: merged,
            unread_count: totalUnread,
            total_count: totalAll,
            filtered_count: filteredTotal,
            hasMore,
            limit,
            offset,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_pending_modals': {
        // Fetch modal notifications that haven't been dismissed yet
        console.log(`[notifications] Fetching pending modal notifications for user ${user.id}`);

        const { data: modalNotifications, error: modalError } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .not('metadata->show_as_modal', 'is', null)
          .order('created_at', { ascending: true }); // Oldest first so they see them in order

        if (modalError) {
          console.error('[notifications] Error fetching modal notifications:', modalError);
          throw modalError;
        }

        // Filter to only those where show_as_modal is true and modal_dismissed_at is null
        const stillPending = (modalNotifications || []).filter(n => {
          const metadata = n.metadata as Record<string, any> | null;
          return metadata?.show_as_modal === true && !metadata?.modal_dismissed_at;
        });

        // De-duplicate stale "turn is almost here" warnings: if a later
        // "missed_harvest" exists for the same spot, the warning is obsolete —
        // the user was offline, their turn already passed. Showing both is
        // confusing. Auto-dismiss the warning(s) so only the outcome is shown.
        const missedSpotIds = new Set<string>();
        for (const n of stillPending) {
          if (n.notification_type === 'missed_harvest') {
            const sid = (n.metadata as any)?.spot_id;
            if (sid) missedSpotIds.add(String(sid));
          }
        }

        const autoDismissIds: string[] = [];
        const pendingFiltered = stillPending.filter(n => {
          if (n.notification_type === 'turn_approaching') {
            const sid = (n.metadata as any)?.spot_id;
            if (sid && missedSpotIds.has(String(sid))) {
              autoDismissIds.push(n.id);
              return false;
            }
          }
          return true;
        });

        // Best-effort auto-dismiss the stale warnings so they don't return
        if (autoDismissIds.length > 0) {
          console.log(`[notifications] Auto-dismissing ${autoDismissIds.length} stale turn_approaching modals (superseded by missed_harvest)`);
          await Promise.all(autoDismissIds.map(async (nid) => {
            const stale = stillPending.find(x => x.id === nid);
            const meta = (stale?.metadata as Record<string, any>) || {};
            await supabase
              .from('notifications')
              .update({
                metadata: { ...meta, modal_dismissed_at: new Date().toISOString(), auto_dismissed_reason: 'superseded_by_missed_harvest' },
                read_at: new Date().toISOString(),
              })
              .eq('id', nid)
              .eq('user_id', user.id);
          }));
        }

        const pendingModals = pendingFiltered.map(n => ({
          id: n.id,
          title: n.title,
          message: n.message,
          icon_template: (n.metadata as any)?.icon_template || 'megaphone',
          cta_button_text: (n.metadata as any)?.cta_button_text,
          cta_button_link: (n.metadata as any)?.cta_button_link,
          created_at: n.created_at,
        }));

        console.log(`[notifications] Found ${pendingModals.length} pending modal notifications`);

        return new Response(
          JSON.stringify({
            success: true,
            modals: pendingModals,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'dismiss_modal': {
        // Mark a modal notification as dismissed
        if (!notification_id) {
          throw new Error('notification_id required for dismiss_modal action');
        }

        console.log(`[notifications] Dismissing modal notification ${notification_id} for user ${user.id}`);

        // First get the current notification to get its metadata
        const { data: notification, error: fetchError } = await supabase
          .from('notifications')
          .select('metadata')
          .eq('id', notification_id)
          .eq('user_id', user.id)
          .single();

        if (fetchError) {
          console.error('[notifications] Error fetching notification for dismiss:', fetchError);
          throw fetchError;
        }

        // Update the metadata to set modal_dismissed_at
        const currentMetadata = (notification?.metadata as Record<string, any>) || {};
        const updatedMetadata = {
          ...currentMetadata,
          modal_dismissed_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
          .from('notifications')
          .update({ 
            metadata: updatedMetadata,
            read_at: new Date().toISOString() // Also mark as read
          })
          .eq('id', notification_id)
          .eq('user_id', user.id);

        if (updateError) {
          console.error('[notifications] Error dismissing modal:', updateError);
          throw updateError;
        }

        console.log(`[notifications] Successfully dismissed modal ${notification_id}`);

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'mark_read': {
        if (!notification_ids || !Array.isArray(notification_ids)) {
          throw new Error('notification_ids array required for mark_read action');
        }

        const now = new Date().toISOString();
        let totalMarked = 0;

        // Group by source
        const userNotifIds = notification_ids.filter(n => n.source === 'notification').map(n => n.id);
        const adminNotifIds = notification_ids.filter(n => n.source === 'admin_notification').map(n => n.id);

        // Mark user notifications as read
        if (userNotifIds.length > 0) {
          const { error: updateError } = await supabase
            .from('notifications')
            .update({ read_at: now })
            .in('id', userNotifIds)
            .eq('user_id', user.id)
            .is('read_at', null);

          if (updateError) {
            console.error('[notifications] Error marking user notifications as read:', updateError);
          } else {
            totalMarked += userNotifIds.length;
          }
        }

        // Mark admin notifications as read (add user.id to read_by array)
        if (adminNotifIds.length > 0 && isAdmin) {
          for (const notifId of adminNotifIds) {
            const { data: notif } = await supabase
              .from('admin_notifications')
              .select('read_by')
              .eq('id', notifId)
              .single();

            if (notif) {
              const readBy = notif.read_by || [];
              if (!readBy.includes(user.id)) {
                await supabase
                  .from('admin_notifications')
                  .update({ read_by: [...readBy, user.id] })
                  .eq('id', notifId);
                totalMarked++;
              }
            }
          }
        }

        console.log(`[notifications] Marked ${totalMarked} notifications as read`);

        return new Response(
          JSON.stringify({ success: true, marked_count: totalMarked }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'mark_all_read': {
        const now = new Date().toISOString();

        // Mark all user notifications as read
        const { error: userUpdateError } = await supabase
          .from('notifications')
          .update({ read_at: now })
          .eq('user_id', user.id)
          .is('read_at', null);

        if (userUpdateError) {
          console.error('[notifications] Error marking all user notifications as read:', userUpdateError);
        }

        // If admin, mark all admin notifications as read for this user
        if (isAdmin) {
          const { data: adminNotifs } = await supabase
            .from('admin_notifications')
            .select('id, read_by');

          if (adminNotifs) {
            for (const notif of adminNotifs) {
              const readBy = notif.read_by || [];
              if (!readBy.includes(user.id)) {
                await supabase
                  .from('admin_notifications')
                  .update({ read_by: [...readBy, user.id] })
                  .eq('id', notif.id);
              }
            }
          }
        }

        console.log('[notifications] Marked all notifications as read');

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('[notifications] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
