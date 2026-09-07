// Receives parsed Moniepoint credit-alert payloads from the Cloudflare
// Email Worker, records the raw event, then delegates matching + crediting
// to the shared RPC (match_and_credit_moniepoint) and shared credit helpers.
//
// verify_jwt is false by design (Cloudflare Worker cannot sign JWTs). We keep
// the surface hostile-safe with:
//   - shape validation on all fields
//   - hard amount ceiling
//   - matching RPC that only credits real pending attempts by name+amount
//   - unique index on transaction_reference for replay safety

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  creditMembership,
  creditDeposit,
  alreadyProcessed,
} from '../_shared/credit-user.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_PLAUSIBLE_CREDIT = 2_000_000; // ₦2M ceiling — anything higher is suspicious

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const {
    email_id,
    credit_amount,
    sender_name,
    account_balance,
    account_number,
    date_time,
    narration,
    subject,
    received_at,
    parse_failed,
    raw_body_preview,
  } = body || {};

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ---- Parse-failed branch: record for admin, do not attempt to match ----
  if (parse_failed === true) {
    if (typeof email_id !== 'string' || email_id.length < 8) {
      return json({ error: 'Missing email_id on parse_failed stub' }, 400);
    }
    await supabase
      .from('unmatched_moniepoint_payments')
      .insert({
        transaction_reference: email_id,
        amount: 0,
        sender_account_name: '__PARSE_FAILED__',
        raw_payload: {
          parse_failed: true,
          raw_body_preview,
          subject,
          received_at,
        },
        reason: 'parse_failed',
        resolved: false,
      });
    return json({ ok: true, status: 'parse_failed_recorded' });
  }

  // ---- Standard validation ----
  if (typeof email_id !== 'string' || email_id.length < 8) {
    return json({ error: 'Missing email_id' }, 400);
  }
  const amt = Number(credit_amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return json({ error: 'Invalid credit_amount' }, 400);
  }
  if (amt > MAX_PLAUSIBLE_CREDIT) {
    console.warn('[moniepoint-email-webhook] amount above ceiling:', amt);
    // Record as unmatched for admin review instead of processing
    await supabase
      .from('unmatched_moniepoint_payments')
      .insert({
        transaction_reference: email_id,
        amount: amt,
        sender_account_name: String(sender_name || '').slice(0, 200),
        raw_payload: body,
        reason: 'amount_above_ceiling',
        resolved: false,
      });
    return json({ ok: true, status: 'amount_above_ceiling' });
  }
  if (typeof sender_name !== 'string' || sender_name.trim().length < 2) {
    return json({ error: 'Missing sender_name' }, 400);
  }

  // ---- Step 1: record raw event (idempotent via unique index) ----
  const rawPayload = {
    email_id,
    credit_amount: amt,
    sender_name,
    account_balance,
    account_number,
    date_time,
    narration,
    subject,
    received_at,
  };

  const { data: inserted, error: insErr } = await supabase
    .from('unmatched_moniepoint_payments')
    .insert({
      transaction_reference: email_id,
      amount: amt,
      sender_account_name: sender_name,
      sender_account_number: null,
      sender_bank_name: null,
      raw_payload: rawPayload,
      reason: 'email_alert_pending_match',
      resolved: false,
    })
    .select('id, resolved, resolved_user_id')
    .single();

  let unmatchedId: string | null = inserted?.id ?? null;
  let alreadyResolved = false;

  if (insErr) {
    const { data: existing } = await supabase
      .from('unmatched_moniepoint_payments')
      .select('id, resolved, resolved_user_id')
      .eq('transaction_reference', email_id)
      .maybeSingle();

    if (!existing) {
      console.error('[moniepoint-email-webhook] insert failed:', insErr);
      return json({ error: 'Storage error', details: insErr.message }, 500);
    }
    unmatchedId = existing.id;
    alreadyResolved = existing.resolved;
  }

  if (alreadyResolved) {
    return json({ ok: true, status: 'already_processed', unmatched_id: unmatchedId });
  }

  // ---- Step 2: atomic match via RPC ----
  const { data: matchResult, error: rpcErr } = await supabase.rpc(
    'match_and_credit_moniepoint',
    {
      _amount: amt,
      _sender_name: sender_name,
      _email_id: email_id,
      _unmatched_id: unmatchedId,
    },
  );

  if (rpcErr) {
    console.error('[moniepoint-email-webhook] RPC failed:', rpcErr);
    return json({ ok: false, error: 'match_failed', details: rpcErr.message }, 200);
  }

  const result = (matchResult ?? {}) as {
    matched?: boolean;
    reason?: string;
    attempt_id?: string;
    user_id?: string;
    purpose?: 'membership' | 'deposit';
    payment_ref?: string;
    paid_amount?: number;
  };

  if (!result.matched) {
    console.log(
      `[moniepoint-email-webhook] not credited (${result.reason}) — amount ₦${amt}, sender "${sender_name}"`
    );
    return json({ ok: true, status: result.reason || 'not_found', unmatched_id: unmatchedId });
  }

  // ---- Step 3: shared credit flow ----
  const userId = result.user_id!;
  const paymentRef = result.payment_ref!;
  const paidAmount = Number(result.paid_amount ?? amt);
  const purpose = result.purpose!;

  try {
    if (!(await alreadyProcessed(supabase, paymentRef))) {
      let email: string | null = null;
      if (purpose === 'membership') {
        const { data: authUser } = await supabase.auth.admin.getUserById(userId);
        email = authUser?.user?.email ?? null;
      }

      const extra = {
        matched_via: 'email_webhook',
        email_id,
        sender_name,
        unmatched_id: unmatchedId,
        attempt_id: result.attempt_id,
      };

      const { data: attempt } = await supabase
        .from('payment_attempts')
        .select('metadata')
        .eq('id', result.attempt_id!)
        .maybeSingle();
      const autoBuySpots =
        Number((attempt?.metadata as any)?.auto_buy_spots) || 0;

      if (purpose === 'membership') {
        await creditMembership(supabase, {
          userId,
          paymentRef,
          paidAmount,
          source: 'moniepoint_webhook',
          extraMetadata: extra,
          email,
          autoBuySpots,
        });
      } else {
        await creditDeposit(supabase, {
          userId,
          paymentRef,
          amount: paidAmount,
          source: 'moniepoint_webhook',
          extraMetadata: extra,
          autoBuySpots,
        });
      }
    }

    // ---- Step 4: ONLY NOW mark the unmatched row resolved ----
    // If credit throws, we never reach here, so admin can retry from the
    // unmatched dashboard (no orphaned "verified but uncredited" state).
    await supabase
      .from('unmatched_moniepoint_payments')
      .update({
        resolved: true,
        resolved_user_id: userId,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', unmatchedId!);

    return json({
      ok: true,
      status: 'credited',
      purpose,
      user_id: userId,
      attempt_id: result.attempt_id,
    });
  } catch (e: any) {
    console.error('[moniepoint-email-webhook] credit failed:', e);
    // Leave unmatched row resolved=false → admin sees it in the dashboard.
    return json(
      {
        ok: false,
        status: 'credit_failed',
        details: e?.message || String(e),
        user_id: userId,
        attempt_id: result.attempt_id,
        unmatched_id: unmatchedId,
      },
      200,
    );
  }
});
