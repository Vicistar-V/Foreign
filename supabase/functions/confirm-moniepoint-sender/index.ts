// Confirm sender bank details for a Moniepoint payment attempt.
// Called when the user clicks "I have made payment" — provides a fallback
// match channel for cases where the email-webhook auto-match missed.
//
// Also re-scans unmatched_moniepoint_payments for a recent transfer that
// matches this attempt's amount + sender, and if it finds a clean one,
// credits the user immediately via the shared matcher path.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  creditMembership,
  creditDeposit,
  alreadyProcessed,
} from '../_shared/credit-user.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Not signed in' }, 200);
    }
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !user) return json({ error: 'Not signed in' }, 200);
    const userId = user.id;

    const body = await req.json().catch(() => ({}));
    const {
      attempt_id,
      sender_bank_code,
      sender_bank_name,
      sender_account_number,
    } = body || {};

    if (!attempt_id) return json({ error: 'Missing attempt id' }, 200);
    if (!sender_account_number || !/^\d{10}$/.test(String(sender_account_number))) {
      return json({ error: 'Enter a valid 10-digit account number' }, 200);
    }
    if (!sender_bank_name) {
      return json({ error: 'Pick the bank you sent from' }, 200);
    }

    // Load the attempt and verify ownership
    const { data: attempt, error: aErr } = await supabase
      .from('payment_attempts')
      .select('id, user_id, status, unique_amount, amount, purpose, metadata')
      .eq('id', attempt_id)
      .maybeSingle();

    if (aErr || !attempt) return json({ error: 'Payment not found' }, 200);
    if (attempt.user_id !== userId) return json({ error: 'Not allowed' }, 200);

    if (attempt.status === 'verified') {
      return json({ success: true, already_verified: true });
    }

    // Update sender info on the attempt
    const { error: updErr } = await supabase
      .from('payment_attempts')
      .update({
        sender_bank_code: sender_bank_code || null,
        sender_bank_name,
        sender_account_number,
      })
      .eq('id', attempt_id);

    if (updErr) {
      return json({ error: 'Could not save details', details: updErr.message }, 200);
    }

    // Try to auto-credit right now: look for an unresolved raw email-webhook
    // event that matches this attempt's amount (±5 tolerance for fat-fingers).
    const expected = Number(attempt.unique_amount);
    const { data: candidates } = await supabase
      .from('unmatched_moniepoint_payments')
      .select('id, amount, sender_account_name, transaction_reference, raw_payload')
      .eq('resolved', false)
      .gte('amount', expected - 5)
      .lte('amount', expected + 5)
      .order('created_at', { ascending: false })
      .limit(5);

    let credited = false;
    let match_result: any = null;

    if (candidates && candidates.length > 0) {
      // Delegate to the same atomic RPC used by the auto-flow.
      // The RPC re-verifies name match against profiles, so we can safely try
      // the newest candidate first.
      for (const c of candidates) {
        const senderName =
          (c.raw_payload as any)?.sender_name || c.sender_account_name;
        if (!senderName) continue;

        const emailId = c.transaction_reference || `manual-${c.id}`;
        const { data: rpcRes, error: rpcErr } = await supabase.rpc(
          'match_and_credit_moniepoint',
          {
            _amount: Number(c.amount),
            _sender_name: senderName,
            _email_id: emailId,
            _unmatched_id: c.id,
          },
        );

        if (rpcErr) {
          console.error('[confirm-moniepoint-sender] RPC error:', rpcErr);
          continue;
        }

        const r = (rpcRes ?? {}) as any;
        if (r.matched && r.user_id === userId) {
          const paymentRef = r.payment_ref as string;
          const paidAmount = Number(r.paid_amount);
          const purpose = r.purpose as 'membership' | 'deposit';

          if (!(await alreadyProcessed(supabase, paymentRef))) {
            const extra = {
              matched_via: 'confirm_sender_fallback',
              email_id: emailId,
              unmatched_id: c.id,
              attempt_id: r.attempt_id,
              sender_name: senderName,
            };
            try {
              const autoBuySpots =
                Number((attempt as any).metadata?.auto_buy_spots) || 0;
              if (purpose === 'membership') {
                await creditMembership(supabase, {
                  userId,
                  paymentRef,
                  paidAmount,
                  source: 'moniepoint_webhook',
                  extraMetadata: extra,
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
              credited = true;
              match_result = r;
              break;
            } catch (e) {
              console.error('[confirm-moniepoint-sender] credit failed:', e);
            }
          } else {
            credited = true;
            match_result = r;
            break;
          }
        }
      }
    }

    return json({
      success: true,
      credited,
      matched_attempt_id: match_result?.attempt_id ?? null,
      possible_match_pending: candidates && candidates.length > 0 && !credited,
    });
  } catch (e: any) {
    console.error('confirm-moniepoint-sender error:', e);
    return json({ error: 'Server error', details: e?.message }, 200);
  }
});
