// Confirm sender bank details for a Moniepoint payment attempt.
// Supports both signed-in members AND guest checkouts from ads.

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

    // 1. Softly identify the user if logged in, but DO NOT block if guest
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const jwt = authHeader.replace('Bearer ', '');
      try {
        const { data: { user } } = await supabase.auth.getUser(jwt);
        if (user) {
          userId = user.id;
        }
      } catch {
        // Guest or anon key — proceed
      }
    }

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

    // 2. Load the attempt
    const { data: attempt, error: aErr } = await supabase
      .from('payment_attempts')
      .select('id, user_id, status, unique_amount, amount, purpose, metadata')
      .eq('id', attempt_id)
      .maybeSingle();

    if (aErr || !attempt) return json({ error: 'Payment not found' }, 200);

    const isGuest = (attempt.metadata as any)?.is_guest === true || !attempt.user_id;

    // Only enforce strict user check if this attempt belongs to a real signed-in account
    if (!isGuest && userId && attempt.user_id !== userId) {
      return json({ error: 'Not allowed' }, 200);
    }

    const targetUserId = attempt.user_id || userId;

    if (attempt.status === 'verified') {
      return json({ success: true, already_verified: true });
    }

    // 3. Update sender info on the attempt
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

    // 4. Try to auto-credit right now if a matching transaction already arrived
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

    if (candidates && candidates.length > 0 && targetUserId) {
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
        if (r.matched && (r.user_id === targetUserId || !r.user_id)) {
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
                  userId: targetUserId,
                  paymentRef,
                  paidAmount,
                  source: 'moniepoint_webhook',
                  extraMetadata: extra,
                  autoBuySpots,
                });
              } else {
                await creditDeposit(supabase, {
                  userId: targetUserId,
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
