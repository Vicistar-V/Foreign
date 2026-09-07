// Paystack server-to-server webhook.
// Signature: HMAC-SHA512 of the raw request body, keyed with PAYSTACK_SECRET_KEY,
// compared against the `x-paystack-signature` header.

import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { paystackVerify, processPaystackPayment } from '../_shared/paystack-processor.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!secret || !signature) return false;
  const computed = createHmac('sha512', secret).update(rawBody).digest('hex');
  // Constant-time-ish compare
  if (computed.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-paystack-signature');

  // Always log the hit for forensics (even failures)
  let webhookLogId: string | null = null;
  try {
    const { data: log } = await supabase
      .from('webhook_logs')
      .insert({
        event_type: 'paystack.incoming',
        event_data: { headers: Object.fromEntries(req.headers), raw_sample: rawBody.slice(0, 5000) },
        signature: signature || null,
      })
      .select('id')
      .single();
    webhookLogId = log?.id ?? null;
  } catch (_) {}

  // Helper: alert the admin dashboard for any webhook-level failure
  // (signature mismatch, verify error, etc.). The shared processor handles
  // per-validation alerts; this covers the layer above it.
  const alertAdmin = async (code: string, reason: string, extra: Record<string, unknown> = {}) => {
    try {
      await supabase.from('admin_notifications').insert({
        notification_type: 'paystack_validation_failure',
        title: `Paystack webhook failed: ${code}`,
        message: reason,
        metadata: { source: 'webhook', code, reason, ...extra },
        link: '/admin/deposits',
      });
    } catch (e) { console.error('alertAdmin insert failed', e); }
    try {
      await supabase.functions.invoke('send-telegram-alert', {
        body: { type: 'system_alert', title: `⚠️ Paystack webhook failed (${code})`, message: reason },
      });
    } catch (e) { console.error('alertAdmin telegram failed', e); }
  };

  if (!verifySignature(rawBody, signature)) {
    console.error('❌ Paystack signature mismatch');
    if (webhookLogId) {
      await supabase.from('webhook_logs').update({ error_message: 'Signature mismatch' }).eq('id', webhookLogId);
    }
    await alertAdmin('SIGNATURE_MISMATCH', 'Paystack webhook signature did not match. Possible forgery or wrong PAYSTACK_SECRET_KEY.', {
      ip: req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for'),
    });
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }


  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('OK', { status: 200 });
  }

  const event = payload?.event;
  const eventData = payload?.data;

  console.log('📩 Paystack event:', event);

  if (event !== 'charge.success') {
    // We currently only act on successful charges. Acknowledge everything else.
    if (webhookLogId) {
      await supabase
        .from('webhook_logs')
        .update({ event_type: event || 'unknown', processed_successfully: true })
        .eq('id', webhookLogId);
    }
    return new Response('OK', { status: 200 });
  }

  try {
    // Trust-but-verify: re-fetch from Paystack to be safe (matches Paystack's recommendation).
    const reference = eventData?.reference;
    if (!reference) {
      throw new Error('Webhook missing reference');
    }

    const verified = await paystackVerify(reference);
    const result = await processPaystackPayment(verified, 'webhook');

    if (webhookLogId) {
      await supabase
        .from('webhook_logs')
        .update({
          event_type: event,
          processed_successfully: result.ok,
          error_message: result.ok ? null : (result as any).reason,
        })
        .eq('id', webhookLogId);
    }

    return new Response('OK', { status: 200 });
  } catch (e: any) {
    console.error('💥 Paystack webhook processing error:', e);
    if (webhookLogId) {
      await supabase.from('webhook_logs').update({ error_message: e?.message || 'Unknown' }).eq('id', webhookLogId);
    }
    await alertAdmin('PROCESSING_ERROR', e?.message || 'Unknown error during webhook processing', {
      reference: eventData?.reference,
    });
    // Always 200 so Paystack doesn't retry-storm us — we have the log for replay.
    return new Response('OK', { status: 200 });
  }
});
