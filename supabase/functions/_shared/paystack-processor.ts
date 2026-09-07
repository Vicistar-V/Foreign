// Shared Paystack payment processor.
//
// Both `paystack-callback` (redirect from user's browser) and `paystack-webhook`
// (server-to-server from Paystack) call into this function. Whichever fires
// first does the work; the other gets the duplicate-key short-circuit and
// quietly succeeds.
//
// IT IS SAFE TO CALL THIS TWICE for the same `reference`.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { safeJson } from './safe-json.ts';

export type ProcessResult = {
  ok: true;
  duplicate: boolean;
  user_id: string;
  amount: number;
  payment_type: 'membership' | 'legacy_activation' | 'deposit';
  is_activation: boolean;
} | {
  ok: false;
  reason: string;
  code: 'BAD_STATUS' | 'INVALID_CURRENCY' | 'MISSING_USER_META' | 'AMOUNT_MISMATCH' | 'USER_NOT_FOUND' | 'DB_ERROR' | 'PAYSTACK_API';
};

export type PaystackVerifyData = {
  id?: number | string;
  status: string;             // 'success' | 'failed' | 'abandoned' | ...
  reference: string;
  amount: number;             // KOBO — what customer actually paid (incl. Paystack fee if customer bears it)
  requested_amount?: number;  // KOBO — what we asked Paystack to charge (preferred for validation)
  currency: string;
  customer?: { email?: string };
  metadata?: any;             // our metadata payload
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export function makeAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

/**
 * Calls Paystack /transaction/verify/:reference and returns the data object.
 * Throws on network / non-2xx.
 */
export async function paystackVerify(reference: string): Promise<PaystackVerifyData> {
  const key = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!key) throw new Error('PAYSTACK_SECRET_KEY not configured');
  const resp = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } }
  );
  const parsed = await safeJson<any>(resp);
  if (!parsed.ok) {
    throw new Error(`Paystack verify gateway error: ${parsed.error}`);
  }
  const json = parsed.data;
  if (!resp.ok || json.status !== true) {
    throw new Error(`Paystack verify failed: ${json.message || resp.statusText}`);
  }
  return json.data as PaystackVerifyData;
}

/**
 * Idempotently apply a verified Paystack payment.
 * - Inserts transaction
 * - Activates membership if applicable
 * - Calls buy-spot for first spot
 * - Pays referral bonus
 * - Fires Telegram + admin notification + queue broadcast (best-effort)
 *
 * Returns ProcessResult.ok=true with duplicate=true if a transaction with this
 * payment_reference already exists.
 */
export async function processPaystackPayment(
  data: PaystackVerifyData,
  source: 'callback' | 'webhook',
): Promise<ProcessResult> {
  const supabase = makeAdminClient();

  // Helper: alert the admin dashboard + Telegram whenever a Paystack
  // payment fails validation. Best-effort — never throws.
  const alertAdmin = async (
    code: string,
    reason: string,
    extra: Record<string, unknown> = {},
  ) => {
    try {
      const title = `Paystack ${source} failed: ${code}`;
      const refSnippet = data?.reference ? ` (ref: ${data.reference})` : '';
      const message = `${reason}${refSnippet}`;
      await supabase.from('admin_notifications').insert({
        notification_type: 'paystack_validation_failure',
        title,
        message,
        metadata: {
          source,
          code,
          reason,
          reference: data?.reference,
          paystack_status: data?.status,
          paystack_amount_kobo: data?.amount,
          paystack_requested_amount_kobo: (data as any)?.requested_amount,
          currency: data?.currency,
          customer_email: data?.customer?.email,
          metadata_user_id: (data?.metadata as any)?.user_id,
          metadata_expected_amount: (data?.metadata as any)?.expected_amount,
          paystack_id: data?.id,
          ...extra,
        },
        link: '/admin/deposits',
      });
    } catch (e) {
      console.error('alertAdmin insert failed', e);
    }

    // Fire-and-forget Telegram alert
    try {
      await supabase.functions.invoke('send-telegram-alert', {
        body: {
          type: 'system_alert',
          title: `⚠️ Paystack ${source} failed (${code})`,
          message: `${reason}\nRef: ${data?.reference ?? 'n/a'}\nUser: ${(data?.metadata as any)?.user_id ?? 'n/a'}`,
        },
      });
    } catch (e) {
      console.error('alertAdmin telegram failed', e);
    }
  };

  if (data.status !== 'success') {
    const reason = `Payment status is ${data.status}`;
    // Don't alert for benign abandoned/pending states — only true failures
    if (data.status === 'failed') await alertAdmin('BAD_STATUS', reason);
    return { ok: false, reason, code: 'BAD_STATUS' };
  }
  if (data.currency !== 'NGN') {
    const reason = `Invalid currency ${data.currency}`;
    await alertAdmin('INVALID_CURRENCY', reason);
    return { ok: false, reason, code: 'INVALID_CURRENCY' };
  }

  const meta = data.metadata || {};
  const userId: string | undefined = meta.user_id;
  if (!userId) {
    const reason = 'Missing user_id in metadata';
    await alertAdmin('MISSING_USER_META', reason);
    return { ok: false, reason, code: 'MISSING_USER_META' };
  }

  // Use `requested_amount` (what we asked Paystack to charge) instead of `amount`
  // (what the customer actually paid). When the merchant has "customer bears fees"
  // enabled, Paystack adds its own gateway fee on top of `requested_amount`, so
  // `amount` will be larger and our strict expected+fee check would falsely fail.
  const anyData = data as any;
  const koboCharged = Number(anyData.requested_amount ?? data.amount);
  const chargedAmount = koboCharged / 100; // kobo → naira
  const processingFee = Number(meta.processing_fee ?? 10);
  const expectedAmount = meta.expected_amount != null ? Number(meta.expected_amount) : (chargedAmount - processingFee);

  // Amount validation: charged should equal expected + fee (allow ₦1 rounding)
  if (meta.expected_amount != null) {
    const expectedCharge = expectedAmount + processingFee;
    if (Math.abs(chargedAmount - expectedCharge) > 1) {
      console.error('❌ Amount mismatch', { chargedAmount, expectedCharge });
      await alertAdmin('AMOUNT_MISMATCH', 'Amount mismatch', {
        charged_naira: chargedAmount,
        expected_charge_naira: expectedCharge,
        expected_amount_naira: expectedAmount,
        processing_fee_naira: processingFee,
      });
      return { ok: false, reason: 'Amount mismatch', code: 'AMOUNT_MISMATCH' };
    }
  }


  // User must exist
  const { data: userProfile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, is_member, phone_number, referred_by_code')
    .eq('id', userId)
    .maybeSingle();
  if (profileError || !userProfile) {
    await alertAdmin('USER_NOT_FOUND', `User ${userId} not found in profiles`, {
      profile_error: profileError?.message,
    });
    return { ok: false, reason: 'User not found', code: 'USER_NOT_FOUND' };
  }

  // Duplicate short-circuit
  const reference = data.reference;
  const { data: existing } = await supabase
    .from('transactions')
    .select('id')
    .eq('payment_reference', reference)
    .maybeSingle();

  if (existing) {
    console.log(`✅ [${source}] Paystack payment already processed: ${reference}`);
    // Mark attempt verified just in case
    await supabase
      .from('payment_attempts')
      .update({ status: 'verified', verified_at: new Date().toISOString(), flutterwave_id: String(data.id ?? '') })
      .eq('tx_ref', reference);
    return {
      ok: true,
      duplicate: true,
      user_id: userId,
      amount: expectedAmount,
      payment_type: 'deposit',
      is_activation: false,
    };
  }

  // Decide payment type
  const { data: config } = await supabase
    .from('platform_config')
    .select('membership_fee, drop_entry_fee, drop_system_active')
    .eq('id', 1)
    .single();

  const loopAmount = Number(config?.drop_entry_fee || 5000);
  const membershipFee = Number(config?.membership_fee || 1000);

  // Has the user got any spots yet?
  const { count: spotCount } = await supabase
    .from('spots')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  const hasNoSpots = (spotCount ?? 0) === 0;
  const isLegacyMember = userProfile.is_member && hasNoSpots;
  const purpose = meta.purpose || 'deposit';

  let paymentType: 'membership' | 'legacy_activation' | 'deposit' = 'deposit';
  let isActivation = false;
  let shouldCreateSpot = false;
  let isMembershipActivation = false;
  let isLegacyActivation = false;

  let txRow: any;
  if ((purpose === 'membership' || expectedAmount === membershipFee) && !userProfile.is_member) {
    paymentType = 'membership';
    isActivation = true;
    isMembershipActivation = true;
    shouldCreateSpot = true;
    txRow = {
      user_id: userId,
      wallet_type: 'deposit',
      amount: loopAmount,
      transaction_type: 'deposit',
      description: 'Activation payment for your first ad share',
      payment_reference: reference,
      status: 'completed',
      metadata: {
        payment_provider: 'paystack',
        payment_purpose: 'membership',
        is_activation: true,
        charged_amount: chargedAmount,
        processing_fee: processingFee,
        activation_paid: expectedAmount,
        loop_amount: loopAmount,
        paystack_id: data.id,
        source,
      },
    };
  } else if ((purpose === 'membership' || expectedAmount === membershipFee) && isLegacyMember) {
    paymentType = 'legacy_activation';
    isActivation = true;
    isLegacyActivation = true;
    shouldCreateSpot = true;
    txRow = {
      user_id: userId,
      wallet_type: 'deposit',
      amount: loopAmount,
      transaction_type: 'deposit',
      description: 'Legacy member activation credit',
      payment_reference: reference,
      status: 'completed',
      metadata: {
        payment_provider: 'paystack',
        payment_purpose: 'legacy_activation',
        is_legacy_member: true,
        charged_amount: chargedAmount,
        processing_fee: processingFee,
        activation_paid: expectedAmount,
        loop_amount: loopAmount,
        paystack_id: data.id,
        source,
      },
    };
  } else {
    txRow = {
      user_id: userId,
      wallet_type: 'deposit',
      amount: expectedAmount,
      transaction_type: 'deposit',
      description: 'Wallet deposit',
      payment_reference: reference,
      status: 'completed',
      metadata: {
        payment_provider: 'paystack',
        payment_purpose: 'deposit',
        charged_amount: chargedAmount,
        processing_fee: processingFee,
        paystack_id: data.id,
        source,
      },
    };
  }

  // Insert transaction
  const { error: insertError } = await supabase.from('transactions').insert(txRow);
  if (insertError) {
    if (insertError.code === '23505' || insertError.message?.includes('duplicate key')) {
      // Webhook/callback race — the other one beat us. That's a win.
      await supabase
        .from('payment_attempts')
        .update({ status: 'verified', verified_at: new Date().toISOString(), flutterwave_id: String(data.id ?? '') })
        .eq('tx_ref', reference);
      return {
        ok: true,
        duplicate: true,
        user_id: userId,
        amount: expectedAmount,
        payment_type: paymentType,
        is_activation: isActivation,
      };
    }
    console.error('❌ Failed to insert transaction:', insertError);
    return { ok: false, reason: insertError.message, code: 'DB_ERROR' };
  }

  // ===== AUTO-BUY SPOTS (deposit only — skip activations) =====
  if (!isActivation) {
    try {
      const requestedSpots = Number((meta as any)?.auto_buy_spots) || 0;
      if (requestedSpots > 0) {
        const { runAutoBuySpots } = await import('./autoBuySpots.ts');
        await runAutoBuySpots(supabase, {
          userId,
          paymentRef: reference,
          count: requestedSpots,
        });
      }
    } catch (autoBuyErr) {
      console.error('⚠️ Paystack auto-buy spots failed (non-critical):', autoBuyErr);
    }
  }

  // Mark attempt verified
  await supabase
    .from('payment_attempts')
    .update({ status: 'verified', verified_at: new Date().toISOString(), flutterwave_id: String(data.id ?? '') })
    .eq('tx_ref', reference);


  // Activate membership
  if (isMembershipActivation || isLegacyActivation) {
    await supabase.from('profiles').update({ is_member: true }).eq('id', userId);
  }

  // Buy first spot
  if (shouldCreateSpot && config?.drop_system_active) {
    try {
      const buySpotResp = await fetch(`${SUPABASE_URL}/functions/v1/buy-spot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({
          target_user_id: userId,
          source_wallet: 'deposit',
          skip_membership_check: true,
        }),
      });
      const spotResult = await buySpotResp.json();
      if (!buySpotResp.ok || spotResult.error) {
        console.error('⚠️ buy-spot failed:', spotResult.error);
      } else {
        console.log('✅ Spot created via buy-spot:', spotResult.spot_id);

        // Instant referral bonus
        if (
          userProfile.referred_by_code &&
          userProfile.referred_by_code !== 'SYSTEM' &&
          userProfile.referred_by_code !== ''
        ) {
          // FLAT PRICING: invite bonus is paid PER SHARE the friend activated.
          const activatedShares =
            1 + Math.max(0, Math.min(Number((meta as any)?.auto_buy_spots) || 0, 100));
          const { error: bonusError } = await supabase.rpc('pay_referrer_activation_bonus', {
            _referee_id: userId,
            _referred_by_code: userProfile.referred_by_code,
            _shares: activatedShares,
          });
          if (bonusError) console.error('⚠️ Referral bonus failed:', bonusError);
        }
      }
    } catch (e) {
      console.error('⚠️ Spot creation error:', e);
    }
  }

  // Telegram alert (non-blocking)
  if (isActivation) {
    try {
      const { data: authData } = await supabase.auth.admin.getUserById(userId);
      const userEmail = authData?.user?.email || data.customer?.email || 'Unknown';
      let referrerName: string | null = null;
      if (userProfile.referred_by_code && userProfile.referred_by_code !== 'SYSTEM') {
        const { data: ref } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('referral_code', userProfile.referred_by_code)
          .single();
        referrerName = ref?.full_name || null;
      }
      await supabase.functions.invoke('send-telegram-alert', {
        body: {
          alertType: 'activation',
          userName: userProfile.full_name || 'Unknown',
          userPhone: userProfile.phone_number,
          userEmail,
          referrerCode: userProfile.referred_by_code,
          referrerName,
          amount: expectedAmount,
          userId,
          note: `Paystack ${source}`,
        },
      });
    } catch (e) {
      console.error('⚠️ Telegram alert failed:', e);
    }
  }

  // Admin in-app notification
  if (isActivation) {
    try {
      await supabase.from('admin_notifications').insert({
        notification_type: 'member_activated',
        title: isLegacyActivation ? 'Legacy Member Activated!' : 'New Member Activated!',
        message: `${userProfile.full_name || 'A user'} just activated via Paystack and started their campaign!`,
        metadata: { user_id: userId, amount: expectedAmount, is_legacy: isLegacyActivation, payment_provider: 'paystack' },
        link: '/admin/users',
      });
    } catch (e) {
      console.error('⚠️ Admin notif failed:', e);
    }
  }

  // Broadcast
  try {
    const { broadcastQueueChanged } = await import('./broadcastQueueChanged.ts');
    broadcastQueueChanged('payment_success').catch(() => {});
  } catch (_) {}

  return {
    ok: true,
    duplicate: false,
    user_id: userId,
    amount: expectedAmount,
    payment_type: paymentType,
    is_activation: isActivation,
  };
}
