// Admin tool: force-approve a pending payment_attempt (Moniepoint).
// Used when the webhook never fired or matching failed, but admin can confirm
// the money landed in the business account. Credits the user using the SAME
// shared crediting logic the webhook uses — no duplication.

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
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Not signed in' }, 401);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return json({ error: 'Bad token' }, 401);

    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });
    if (!isAdmin) return json({ error: 'Forbidden' }, 403);

    const body = await req.json().catch(() => ({}));
    const { attempt_id, override_amount } = body || {};
    if (!attempt_id) return json({ error: 'attempt_id is required' }, 400);

    const { data: attempt, error: aErr } = await supabase
      .from('payment_attempts')
      .select('*')
      .eq('id', attempt_id)
      .single();
    if (aErr || !attempt) return json({ error: 'Payment attempt not found' }, 404);

    const purpose = attempt.purpose === 'membership' ? 'membership' : 'deposit';
    const targetUser = attempt.user_id as string;
    const paidAmount = Number(override_amount || attempt.amount);
    const paymentRef = `MNP-ADMIN-${attempt.tx_ref || attempt.id}`;

    // If the attempt is already verified BUT no credit tx exists (orphaned
    // "verified but uncredited" from a mid-flight webhook crash), fall through
    // and re-credit. Otherwise no-op.
    if (attempt.status === 'verified') {
      const done = await alreadyProcessed(supabase, paymentRef);
      // Also check the webhook-side payment_ref shape, in case the webhook path already credited.
      const webhookRef = (attempt.metadata as any)?.matched_email_id
        ? `MNP-EMAIL-${(attempt.metadata as any).matched_email_id}`
        : null;
      const webhookDone = webhookRef ? await alreadyProcessed(supabase, webhookRef) : false;
      if (done || webhookDone) {
        return json({ ok: true, already_verified: true });
      }
      // else: proceed to credit under the admin paymentRef below
    }

    if (!(await alreadyProcessed(supabase, paymentRef))) {
      const extra = {
        admin_approved_by: user.id,
        attempt_id,
      };
      const autoBuySpots = Number((attempt.metadata as any)?.auto_buy_spots) || 0;
      if (purpose === 'membership') {
        await creditMembership(supabase, {
          userId: targetUser,
          paymentRef,
          paidAmount,
          source: 'admin_approve_attempt',
          extraMetadata: extra,
          skipTelegram: false,
          autoBuySpots,
        });
      } else {
        await creditDeposit(supabase, {
          userId: targetUser,
          paymentRef,
          amount: paidAmount,
          source: 'admin_approve_attempt',
          extraMetadata: extra,
          autoBuySpots,
        });
      }

    }

    await supabase
      .from('payment_attempts')
      .update({
        status: 'verified',
        verified_at: new Date().toISOString(),
        metadata: {
          ...(attempt.metadata || {}),
          admin_approved_by: user.id,
          admin_approved_at: new Date().toISOString(),
        },
      })
      .eq('id', attempt_id);

    // Kill leftover pending membership drafts for this user (matches auto-flow behavior)
    if (purpose === 'membership') {
      await supabase.rpc('fail_stale_membership_attempts', {
        _user_id: targetUser,
        _except_id: attempt_id,
        _reason: 'admin_approved_sibling',
      });
    }

    return json({ ok: true });
  } catch (e: any) {
    console.error('admin-approve-payment-attempt error:', e);
    return json({ error: e?.message || 'Server error' }, 500);
  }
});
