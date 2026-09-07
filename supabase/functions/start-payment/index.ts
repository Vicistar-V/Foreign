// start-payment — server-side dispatcher that ALWAYS reads the current
// payment provider from platform_config at the moment of the click, then
// routes to the right initializer. This eliminates the bug where a stale
// client-cached `payment_provider` would send a user to the old provider
// after the admin switched it.
//
// Returns one of:
//   { provider: 'moniepoint' }                       — open in-app drawer
//   { provider: 'flutterwave'|'paystack', paymentLink: string, reference }
//   { error, details }                               — error
//
// Cloak access key is NEVER sent to the third-party. Callback `origin`
// passed to the underlying initiator is the bare frontend origin only.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

type Provider = 'moniepoint' | 'flutterwave' | 'paystack';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Not logged in', errorCode: 'UNAUTHORIZED' }, 200);
    }

    const body = await req.json().catch(() => ({}));
    const { amount, metadata } = body || {};
    const purpose = metadata?.purpose || 'deposit';

    if (!amount || typeof amount !== 'number' || amount < 50) {
      return json({ error: 'Invalid amount' }, 200);
    }

    // ---- Read the LIVE provider every time (no caching) ----
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: cfg, error: cfgErr } = await admin
      .from('platform_config')
      .select('payment_provider, maintenance_mode')
      .eq('id', 1)
      .single();

    if (cfgErr) {
      console.error('start-payment: cfg read error', cfgErr);
      return json({ error: 'System error', details: cfgErr.message }, 200);
    }
    if (cfg.maintenance_mode) {
      return json({ error: 'Platform is under maintenance', errorCode: 'MAINTENANCE' }, 200);
    }

    const provider = (cfg.payment_provider as Provider) || 'moniepoint';

    if (provider === 'moniepoint') {
      return json({ provider: 'moniepoint' });
    }

    const fnName = provider === 'paystack' ? 'initiate-paystack-payment' : 'initiate-deposit';

    // Forward the user's auth header + the original origin so the
    // initializer builds a callback that redirects back to the SPA.
    const origin = req.headers.get('origin') || '';
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        ...(origin ? { 'origin': origin } : {}),
      },
      body: JSON.stringify({ amount, metadata }),
    });
    const data = await resp.json().catch(() => ({}));

    if (data?.paymentLink) {
      return json({ provider, paymentLink: data.paymentLink, reference: data.reference });
    }
    return json({
      provider,
      error: data?.error || 'Failed to start payment',
      details: data?.details,
    }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('start-payment error:', e);
    return json({ error: 'Internal server error', details: msg }, 200);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
