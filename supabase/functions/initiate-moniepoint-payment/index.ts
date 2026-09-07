// Initiate a Moniepoint manual bank-transfer payment.
// Supports both signed-in users AND anonymous guest checkout from ads.

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Extract user if logged in, otherwise flag as guest (DO NOT REJECT)
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let userEmail: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const jwt = authHeader.replace('Bearer ', '');
      try {
        const payload = JSON.parse(atob(jwt.split('.')[1]));
        // Ensure it's an actual user ID, not an anon API key
        if (payload?.sub && payload.role !== 'anon') {
          userId = payload.sub;
          userEmail = payload.email ?? null;
        }
      } catch {
        // Bad or anonymous token — fallback to guest
      }
    }

    let isGuest = false;

    // 2. If visitor has no account (cold traffic from Ads), create a guest profile
    // This ensures foreign key constraints on 'payment_attempts.user_id' NEVER break.
    if (!userId) {
      isGuest = true;
      const guestSuffix = Math.random().toString(36).slice(2, 8);
      const guestEmail = `guest_${Date.now()}_${guestSuffix}@access.guest`;
      const guestPassword = `Guest_${Date.now()}_${guestSuffix}!`;

      try {
        const { data: newGuest } = await supabase.auth.admin.createUser({
          email: guestEmail,
          password: guestPassword,
          email_confirm: true,
          user_metadata: {
            is_guest: true,
            source: 'cloak_landing',
          },
        });

        if (newGuest?.user?.id) {
          userId = newGuest.user.id;
          userEmail = guestEmail;
        }
      } catch (err) {
        console.warn('Could not provision guest auth user, using null:', err);
      }
    }

    const body = await req.json().catch(() => ({}));
    const {
      amount,
      purpose = 'membership',
      sender_bank_code,
      sender_bank_name,
      sender_account_number,
      auto_buy_spots,
      expected_payout,
      resume_attempt_id,
    } = body || {};

    // ---- Load platform Moniepoint config ----
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

    // ---- RESUME PATH (Restoring session after mobile app switch) ----
    if (resume_attempt_id && typeof resume_attempt_id === 'string') {
      const { data: existing, error: exErr } = await supabase
        .from('payment_attempts')
        .select('id, user_id, tx_ref, amount, unique_amount, purpose, status, provider, metadata, created_at')
        .eq('id', resume_attempt_id)
        .maybeSingle();

      if (exErr || !existing) {
        return json({ error: 'Payment not found', not_found: true }, 200);
      }
      
      const md = (existing.metadata as any) || {};

      // Only block mismatch if it belonged to an existing signed-in account
      if (existing.user_id && userId && existing.user_id !== userId && !md.is_guest) {
        return json({ error: 'Payment not found', not_found: true }, 200);
      }

      return json({
        success: true,
        resumed: true,
        attempt_id: existing.id,
        tx_ref: existing.tx_ref,
        base_amount: existing.amount,
        unique_amount: existing.unique_amount ?? existing.amount,
        purpose: existing.purpose || md.purpose || 'membership',
        auto_buy_spots: Number(md.auto_buy_spots) || 0,
        expected_payout: Number(md.expected_payout) || undefined,
        status: existing.status,
        business_account: businessAccount,
        expires_in_minutes: 30,
      });
    }

    // ---- Validate inputs ----
    if (!amount || typeof amount !== 'number' || amount < 100) {
      return json({ error: 'Enter a valid amount (₦100 minimum)' }, 200);
    }
    if (config.maintenance_mode) {
      return json({ error: 'Platform is under maintenance. Please try again shortly.' }, 200);
    }

    const source: string | null =
      typeof body?.source === 'string' && body.source.length <= 60 
        ? body.source 
        : (isGuest ? 'cloak_landing_guest' : null);

    // ---- Only check existing membership for verified signed-in users (not guests) ----
    if (purpose === 'membership' && userId && !isGuest) {
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

      // Dedupe open attempts for signed-in users within 30 min
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

    const baseAmount = Math.round(Number(amount));
    const uniqueAmount = baseAmount;
    const txRef = genTxRef();
    const promisedPayout = Math.max(0, Math.round(Number(expected_payout) || 0));

    // ---- Create pending payment attempt ----
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
          is_guest: isGuest,
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
