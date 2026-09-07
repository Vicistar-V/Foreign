// restore-capacity — 1-click "get all my spots back" checkout for
// members whose entire fleet retired after payout. Delegates the heavy
// lifting to `_shared/restoreCapacity.ts` so the deposit webhook can
// auto-resume the same flow after a shortfall top-up.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { runRestoreCapacity } from '../_shared/restoreCapacity.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Not logged in' }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const token = authHeader.replace('Bearer ', '');
    const { data: authRes, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authRes?.user) return json({ error: 'Invalid session' }, 401);
    const userId = authRes.user.id;

    const body = await req.json().catch(() => ({}));
    const rawCount = Number(body?.count);
    const count = Math.max(1, Math.min(50, Math.floor(Number.isFinite(rawCount) ? rawCount : 0)));
    if (!count) return json({ error: 'Invalid ad share count' }, 400);

    const result = await runRestoreCapacity({
      supabase,
      userId,
      count,
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_ROLE,
    });

    const status = result.status ?? 200;
    // Strip our internal "status" field before returning
    const { status: _s, ...rest } = result;
    return json(rest, status);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('restore-capacity error:', e);
    return json({ error: msg }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
