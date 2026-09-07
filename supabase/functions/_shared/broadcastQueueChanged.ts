// Lightweight Realtime Broadcast helper.
// Sends a single fire-and-forget broadcast to the 'public:queue-live' channel.
// No DB writes, no triggers, no WAL traffic.
export async function broadcastQueueChanged(reason: string = 'queue_changed'): Promise<void> {
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) return;

    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: 'public:queue-live',
            event: 'queue_changed',
            payload: { reason, at: new Date().toISOString() },
            private: false,
          },
        ],
      }),
    });
  } catch (err) {
    console.error('[broadcastQueueChanged] failed (non-fatal):', err);
  }
}
