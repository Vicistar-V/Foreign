// Admin tool: credit a user from an unmatched Moniepoint payment.
// Uses the SAME shared crediting logic the webhook uses — no duplication.

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
    const { unmatched_id, target_user_id, purpose } = body || {};
    if (!unmatched_id || !target_user_id || !['membership', 'deposit'].includes(purpose)) {
      return json({ error: 'unmatched_id, target_user_id and valid purpose are required' }, 400);
    }

    const { data: unmatched, error: uErr } = await supabase
      .from('unmatched_moniepoint_payments')
      .select('*')
      .eq('id', unmatched_id)
      .single();
    if (uErr || !unmatched) return json({ error: 'Unmatched payment not found' }, 404);
    if (unmatched.resolved) return json({ error: 'Already resolved' }, 409);

    const paidAmount = Number(unmatched.amount);
    // Canonical ref keyed on email_id when available, so it collides with the
    // webhook's MNP-EMAIL-* ref → alreadyProcessed prevents cross-path double-credit.
    const paymentRef = unmatched.transaction_reference
      ? `MNP-EMAIL-${unmatched.transaction_reference}`
      : `MNP-MANUAL-${unmatched.id}`;

    if (!(await alreadyProcessed(supabase, paymentRef))) {
      const extra = {
        unmatched_id,
        credited_by: user.id,
        manual_override: true,
      };
      if (purpose === 'membership') {
        await creditMembership(supabase, {
          userId: target_user_id,
          paymentRef,
          paidAmount,
          source: 'admin_manual_match',
          extraMetadata: extra,
        });
      } else {
        await creditDeposit(supabase, {
          userId: target_user_id,
          paymentRef,
          amount: paidAmount,
          source: 'admin_manual_match',
          extraMetadata: extra,
        });
      }
    }

    await supabase
      .from('unmatched_moniepoint_payments')
      .update({
        resolved: true,
        resolved_by: user.id,
        resolved_user_id: target_user_id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', unmatched_id);

    // Kill leftover pending drafts for this user (per purpose)
    if (purpose === 'membership') {
      await supabase.rpc('fail_stale_membership_attempts', {
        _user_id: target_user_id,
        _except_id: unmatched_id,
        _reason: 'admin_manual_match_sibling',
      });
    } else {
      // Deposit: mark same-user pending deposit drafts as failed (audit trail).
      await supabase
        .from('payment_attempts')
        .update({
          status: 'failed',
          metadata: { superseded_reason: 'admin_manual_deposit_credit', superseded_at: new Date().toISOString() },
        })
        .eq('user_id', target_user_id)
        .eq('status', 'pending')
        .eq('purpose', 'deposit')
        .eq('provider', 'moniepoint');
    }

    return json({ ok: true });
  } catch (e: any) {
    console.error('admin-credit-unmatched-payment error:', e);
    return json({ error: e?.message || 'Server error' }, 500);
  }
});
