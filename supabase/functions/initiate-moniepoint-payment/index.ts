// Initiate a Moniepoint manual bank-transfer payment.
// Creates a pending payment_attempts row with a unique amount (random kobo)
// and returns the business account + reference details for the user to pay into.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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

function genTxRef() {
  return `MNP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// NOTE: We no longer add a random kobo decimal. Moniepoint webhooks are not
// reliable enough to depend on, so verification is now handled by an admin
// from the dashboard. The user just sends the clean round amount.

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
    let userId: string;
    let userEmail: string | null = null;
    try {
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      userId = payload.sub;
      userEmail = payload.email ?? null;
    } catch {
      return json({ error: 'Bad token' }, 200);
    }
    if (!userId) return json({ error: 'Not signed in' }, 200);

    const body = await req.json().catch(() => ({}));
    const {
      amount,
      purpose = 'deposit',
      sender_bank_code,
      sender_bank_name,
      sender_account_number,
      auto_buy_spots,
      expected_payout,
      resume_attempt_id,
    } = body || {};


    // ---- Load config (must have business account) — needed for both fresh & resume ----
    const { data: config, error: cfgErr } = await supabase
      .from('platform_config')
      .select('maintenance_mode, moniepoint_account_number, moniepoint_account_name, moniepoint_bank_name')
      .eq('id', 1)
      .single();
    if (cfgErr || !config) {
      return json({ error: 'System error', details: cfgErr?.message }, 200);
    }
    if (!config.moniepoint_account_number) {
      return json({
        error: 'Bank transfer is being set up. Please try again in a few minutes.',
      }, 200);
    }

    const businessAccount = {
      account_number: config.moniepoint_account_number,
      account_name: config.moniepoint_account_name,
      bank_name: config.moniepoint_bank_name || 'Moniepoint MFB',
    };

    // ---- RESUME PATH: rehydrate an existing attempt (used when the user
    // reloads the page — the drawer URL carries ?pay=<attempt_id>). ----
    if (resume_attempt_id && typeof resume_attempt_id === 'string') {
      const { data: existing, error: exErr } = await supabase
        .from('payment_attempts')
        .select('id, user_id, tx_ref, amount, unique_amount, purpose, status, provider, metadata, created_at')
        .eq('id', resume_attempt_id)
        .maybeSingle();
      if (exErr || !existing) {
        return json({ error: 'Payment not found', not_found: true }, 200);
      }
      if (existing.user_id !== userId) {
        return json({ error: 'Payment not found', not_found: true }, 200);
      }
      if (existing.provider !== 'moniepoint') {
        return json({ error: 'Not a bank transfer payment', not_found: true }, 200);
      }
      const md = (existing.metadata as any) || {};
      return json({
        success: true,
        resumed: true,
        attempt_id: existing.id,
        tx_ref: existing.tx_ref,
        base_amount: existing.amount,
        unique_amount: existing.unique_amount ?? existing.amount,
        purpose: existing.purpose || md.purpose || 'deposit',
        auto_buy_spots: Number(md.auto_buy_spots) || 0,
        expected_payout: Number(md.expected_payout) || undefined,
        status: existing.status, // 'pending' | 'verified' | 'failed'
        business_account: businessAccount,
        expires_in_minutes: 30,
      });
    }

    // ---- Validate inputs (fresh initiation only) ----
    if (!amount || typeof amount !== 'number' || amount < 100) {
      return json({ error: 'Enter a valid amount (₦100 minimum)' }, 200);
    }
    if (config.maintenance_mode) {
      return json({ error: 'Platform is under maintenance. Please try again shortly.' }, 200);
    }
    // Sender info is now optional at initiation — collected later as a fallback
    // if the webhook auto-match misses. Only validate if provided.
    if (sender_account_number && !/^\d{10}$/.test(String(sender_account_number))) {
      return json({ error: 'Enter a valid 10-digit sender account number' }, 200);
    }

    // Optional caller-supplied trace string ("welcome_modal", "wallet_card",
    // "account_status_card", "machines_card", "activation_success_screen"...).
    // Purely observability — helps admin see WHICH button fired an attempt.
    const source: string | null =
      typeof body?.source === 'string' && body.source.length <= 60 ? body.source : null;

    // ---- GUARD 1: never let an already-activated member pay membership again.
    // This is the actual bug that just charged a member ₦5,000 twice — a stale
    // non-member CTA on the dashboard fired startMembershipPayment while the
    // profile query was still returning is_member=false from before webhook.
    if (purpose === 'membership') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_member')
        .eq('id', userId)
        .maybeSingle();
      if (profile?.is_member) {
        return json({
          error: 'You are already a member — no need to pay again.',
          already_member: true,
        }, 200);
      }

      // ---- GUARD 2: dedupe pending membership attempts within 30 minutes.
      // If one already exists, resume it instead of creating a new row so the
      // user never gets billed twice while the previous one is still open.
      const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: openAttempt } = await supabase
        .from('payment_attempts')
        .select('id, tx_ref, amount, unique_amount, purpose, metadata, created_at')
        .eq('user_id', userId)
        .eq('purpose', 'membership')
        .eq('provider', 'moniepoint')
        .eq('status', 'pending')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (openAttempt) {
        const md = (openAttempt.metadata as any) || {};
        return json({
          success: true,
          resumed: true,
          attempt_id: openAttempt.id,
          tx_ref: openAttempt.tx_ref,
          base_amount: openAttempt.amount,
          unique_amount: openAttempt.unique_amount ?? openAttempt.amount,
          purpose: openAttempt.purpose,
          auto_buy_spots: Number(md.auto_buy_spots) || 0,
          expected_payout: Number(md.expected_payout) || undefined,
          status: 'pending',
          business_account: businessAccount,
          expires_in_minutes: 30,
        });
      }
    }

    // ---- Build unique amount ----
    const baseAmount = Math.round(Number(amount));
    const uniqueAmount = baseAmount;
    const txRef = genTxRef();
    const promisedPayout = Math.max(0, Math.round(Number(expected_payout) || 0));

    // ---- Insert pending payment attempt ----
    const { data: attempt, error: insErr } = await supabase
      .from('payment_attempts')
      .insert({
        user_id: userId,
        amount: baseAmount,
        tx_ref: txRef,
        status: 'pending',
        purpose,
        provider: 'moniepoint',
        sender_bank_code: sender_bank_code || null,
        sender_bank_name: sender_bank_name || null,
        sender_account_number: sender_account_number || null,
        unique_amount: uniqueAmount,
        metadata: {
          purpose,
          base_amount: baseAmount,
          unique_amount: uniqueAmount,
          user_email: userEmail,
          auto_buy_spots: Math.max(0, Math.min(Number(auto_buy_spots) || 0, 100)),
          expected_payout: promisedPayout || null,
          source,
        },
      })
      .select('id, tx_ref, unique_amount, amount, purpose, created_at')
      .single();

    if (insErr || !attempt) {
      console.error('Failed to create attempt:', insErr);
      return json({ error: 'Could not start payment', details: insErr?.message }, 200);
    }

    return json({
      success: true,
      attempt_id: attempt.id,
      tx_ref: attempt.tx_ref,
      base_amount: baseAmount,
      unique_amount: attempt.unique_amount,
      purpose,
      auto_buy_spots: Math.max(0, Math.min(Number(auto_buy_spots) || 0, 100)),
      expected_payout: promisedPayout || undefined,
      status: 'pending',
      business_account: businessAccount,
      expires_in_minutes: 30,
    });

  } catch (e: any) {
    console.error('initiate-moniepoint-payment error:', e);
    return json({ error: 'Server error', details: e?.message }, 200);
  }
});
