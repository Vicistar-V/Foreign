// ============================================
// 🔐 ADMIN PAYMENT ACTION
// Verify (with Flutterwave), Complete (manual), or Reject a payment_attempt.
//
// CRITICAL: This must use the shared crediting helpers so that approving a
// payment ACTUALLY does what the user paid for:
//   - membership → flip is_member, credit first spot, buy-spot, referral bonus
//   - deposit    → credit deposit wallet, auto-buy spots if requested
// Previously this file only inserted a transactions row, so admin approvals
// silently did nothing (no membership, no spots). That's fixed here by
// delegating to creditMembership / creditDeposit (same helpers used by the
// Moniepoint webhook and admin-approve-payment-attempt).
// ============================================

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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    console.log('🔐 admin-payment-action: Starting...');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Not authenticated' }, 401);

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (userError || !user) return json({ error: 'Not authenticated' }, 401);

    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });
    if (!isAdmin) return json({ error: 'Admin access required' }, 403);

    console.log('✅ Admin verified:', user.id);

    const body = await req.json();
    const { attempt_id, action, reason, transaction_id } = body || {};

    if (!['verify', 'complete', 'reject'].includes(action)) {
      return json({ error: 'Invalid action. Use: verify, complete, or reject' }, 400);
    }
    if (!attempt_id && !transaction_id) {
      return json({ error: 'Please provide attempt_id or transaction_id' }, 400);
    }

    console.log('🔍 Processing action:', { action, attempt_id, transaction_id });

    // -------- Load attempt --------
    let paymentAttempt: any = null;
    let targetUserId: string | null = null;
    let txRef: string | null = null;

    if (attempt_id) {
      const { data: attempt, error: attemptError } = await supabase
        .from('payment_attempts')
        .select('*')
        .eq('id', attempt_id)
        .maybeSingle();

      if (attemptError || !attempt) return json({ error: 'Payment attempt not found' }, 404);

      paymentAttempt = attempt;
      targetUserId = attempt.user_id;
      txRef = attempt.tx_ref;

      if (attempt.status === 'verified' && action !== 'verify') {
        return json({ status: 'already_done', message: 'This payment was already processed' });
      }
    }

    const { data: profile } = targetUserId
      ? await supabase
          .from('profiles')
          .select('full_name, is_member')
          .eq('id', targetUserId)
          .single()
      : { data: null as any };

    // Pull email separately (auth.users) for telegram alerts.
    let userEmail: string | null = null;
    if (targetUserId) {
      const { data: au } = await supabase.auth.admin.getUserById(targetUserId);
      userEmail = au?.user?.email ?? null;
    }

    const autoBuySpots = Math.max(
      0,
      Math.min(Number(paymentAttempt?.metadata?.auto_buy_spots) || 0, 100),
    );

    // ============================================
    // ACTION: VERIFY (Flutterwave round-trip)
    // ============================================
    if (action === 'verify') {
      const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
      if (!flutterwaveSecretKey) return json({ error: 'Flutterwave not configured' }, 500);

      let verificationData: any;

      if (transaction_id) {
        const r = await fetch(
          `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
          { headers: { Authorization: `Bearer ${flutterwaveSecretKey}` } },
        );
        if (!r.ok) {
          if (r.status === 404) {
            return json({ status: 'not_found', message: 'Transaction not found in Flutterwave' });
          }
          throw new Error(`Flutterwave error: ${r.status}`);
        }
        verificationData = await r.json();
      } else if (txRef) {
        const r = await fetch(
          `https://api.flutterwave.com/v3/transactions?tx_ref=${encodeURIComponent(txRef)}`,
          { headers: { Authorization: `Bearer ${flutterwaveSecretKey}` } },
        );
        if (!r.ok) throw new Error(`Flutterwave search error: ${r.status}`);
        const s = await r.json();
        if (!s.data || s.data.length === 0) {
          return json({
            status: 'not_found',
            message: 'Payment not found in Flutterwave. User may not have completed the payment.',
          });
        }
        verificationData = { data: s.data[0] };
      } else {
        return json({ error: 'No identifier provided for verification' }, 400);
      }

      const txData = verificationData.data;
      const flutterwaveId = txData.id;
      const paymentStatus = txData.status;
      const paidAmount = Number(txData.amount);
      const flutterwaveTxRef = txData.tx_ref;
      const paymentPurpose =
        txData.meta?.purpose || paymentAttempt?.purpose || 'deposit';
      const resolvedUserId = txData.meta?.user_id || targetUserId;

      if (paymentStatus !== 'successful') {
        if (paymentAttempt && paymentStatus === 'failed') {
          await supabase
            .from('payment_attempts')
            .update({ status: 'failed', verified_at: new Date().toISOString() })
            .eq('id', paymentAttempt.id);
        }
        return json({
          status: paymentStatus === 'pending' ? 'pending' : 'failed',
          message:
            paymentStatus === 'pending'
              ? 'Payment is still being processed by Flutterwave'
              : 'Payment was not successful in Flutterwave',
        });
      }

      if (!resolvedUserId) {
        return json({
          status: 'invalid',
          message: 'Cannot determine which user this payment belongs to',
        });
      }

      // Idempotency — already credited?
      if (await alreadyProcessed(supabase, flutterwaveTxRef)) {
        if (paymentAttempt) {
          await supabase
            .from('payment_attempts')
            .update({
              status: 'verified',
              verified_at: new Date().toISOString(),
              flutterwave_id: flutterwaveId?.toString(),
            })
            .eq('id', paymentAttempt.id);
        }
        return json({
          status: 'already_done',
          message: 'This payment was already processed in the system',
        });
      }

      const extra = {
        verified_by_admin: user.id,
        flutterwave_id: flutterwaveId,
        admin_reason: reason || 'Admin verification',
        attempt_id: paymentAttempt?.id ?? null,
      };

      const isMembership = paymentPurpose === 'membership';
      let activated = false;

      if (isMembership) {
        const res = await creditMembership(supabase, {
          userId: resolvedUserId,
          paymentRef: flutterwaveTxRef,
          paidAmount,
          source: 'admin_flutterwave_verify',
          extraMetadata: extra,
          email: userEmail,
          skipTelegram: false,
          autoBuySpots,
        });
        activated = res.activated;
      } else {
        await creditDeposit(supabase, {
          userId: resolvedUserId,
          paymentRef: flutterwaveTxRef,
          amount: paidAmount,
          source: 'admin_flutterwave_verify',
          extraMetadata: extra,
          autoBuySpots,
        });
      }

      if (paymentAttempt) {
        await supabase
          .from('payment_attempts')
          .update({
            status: 'verified',
            verified_at: new Date().toISOString(),
            flutterwave_id: flutterwaveId?.toString(),
          })
          .eq('id', paymentAttempt.id);
      }

      return json({
        status: 'success',
        message: isMembership
          ? `Membership activated for ${profile?.full_name ?? 'user'}. ₦${paidAmount.toLocaleString()} processed.${activated ? '' : ' (Already a member — payment recorded.)'}`
          : `Deposit of ₦${paidAmount.toLocaleString()} credited${autoBuySpots ? ` and ${autoBuySpots} ad share(s) activated` : ''}.`,
        type: isMembership ? 'membership' : 'deposit',
        amount: paidAmount,
        user_name: profile?.full_name,
      });
    }

    // ============================================
    // ACTION: COMPLETE (manual approval, no gateway round-trip)
    // ============================================
    if (action === 'complete') {
      if (!paymentAttempt) {
        return json({ error: 'Payment attempt required for manual completion' }, 400);
      }

      if (await alreadyProcessed(supabase, txRef!)) {
        await supabase
          .from('payment_attempts')
          .update({ status: 'verified', verified_at: new Date().toISOString() })
          .eq('id', paymentAttempt.id);
        return json({ status: 'already_done', message: 'This payment was already processed' });
      }

      const paidAmount = Number(paymentAttempt.amount);
      const isMembership = paymentAttempt.purpose === 'membership';
      const extra = {
        manual_approval_by: user.id,
        admin_reason: reason || 'Admin manual approval',
        attempt_id: paymentAttempt.id,
      };

      let activated = false;
      if (isMembership) {
        const res = await creditMembership(supabase, {
          userId: targetUserId!,
          paymentRef: txRef!,
          paidAmount,
          source: 'admin_approve_attempt',
          extraMetadata: extra,
          email: userEmail,
          skipTelegram: false,
          autoBuySpots,
        });
        activated = res.activated;
      } else {
        await creditDeposit(supabase, {
          userId: targetUserId!,
          paymentRef: txRef!,
          amount: paidAmount,
          source: 'admin_approve_attempt',
          extraMetadata: extra,
          autoBuySpots,
        });
      }

      await supabase
        .from('payment_attempts')
        .update({
          status: 'verified',
          verified_at: new Date().toISOString(),
          metadata: {
            ...(paymentAttempt.metadata || {}),
            manual_approval_by: user.id,
            approval_reason: reason,
            approved_at: new Date().toISOString(),
          },
        })
        .eq('id', paymentAttempt.id);

      return json({
        status: 'success',
        message: isMembership
          ? `Membership activated for ${profile?.full_name ?? 'user'}. ₦${paidAmount.toLocaleString()} credited.${activated ? '' : ' (Already a member — payment recorded.)'}`
          : `Deposit of ₦${paidAmount.toLocaleString()} credited to ${profile?.full_name ?? 'user'}${autoBuySpots ? ` and ${autoBuySpots} ad share(s) activated` : ''}.`,
        type: isMembership ? 'membership' : 'deposit',
      });
    }

    // ============================================
    // ACTION: REJECT
    // ============================================
    if (action === 'reject') {
      if (!paymentAttempt) return json({ error: 'Payment attempt required for rejection' }, 400);

      await supabase
        .from('payment_attempts')
        .update({
          status: 'failed',
          verified_at: new Date().toISOString(),
          metadata: {
            ...(paymentAttempt.metadata || {}),
            rejected_by: user.id,
            rejection_reason: reason || 'Rejected by admin',
            rejected_at: new Date().toISOString(),
          },
        })
        .eq('id', paymentAttempt.id);

      return json({
        status: 'success',
        message: `Payment attempt rejected. User: ${profile?.full_name ?? 'unknown'}`,
      });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('💥 admin-payment-action error:', msg);
    return json({ error: msg }, 500);
  }
});
