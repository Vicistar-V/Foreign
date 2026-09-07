// Single source of truth for crediting a user after a confirmed payment.
// Used by: moniepoint-webhook, admin-approve-payment-attempt,
// admin-credit-unmatched-payment, and (the credit tail of) admin-payment-action.
//
// If the activation/credit flow ever changes (referral amount, spot price,
// new side-effect), update it here ONCE and every entry path picks it up.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export type CreditSource =
  | 'moniepoint_webhook'
  | 'admin_manual_match'
  | 'admin_approve_attempt'
  | 'admin_flutterwave_verify';

export function makeServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

/**
 * Returns true if a transaction with this payment_reference already exists.
 * Use BEFORE calling creditMembership/creditDeposit to make crediting idempotent.
 */
export async function alreadyProcessed(
  supabase: SupabaseClient,
  paymentRef: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('transactions')
    .select('id')
    .eq('payment_reference', paymentRef)
    .maybeSingle();
  return !!data;
}

export interface CreditMembershipOpts {
  userId: string;
  paymentRef: string;
  paidAmount: number;
  source: CreditSource;
  /** Extra metadata to stamp on the tracking transaction (e.g. credited_by adminId) */
  extraMetadata?: Record<string, unknown>;
  /** Optional — only used for telegram alert. */
  email?: string | null;
  /** Skip telegram alert (admin paths typically skip). */
  skipTelegram?: boolean;
  /** Extra spots to auto-buy AFTER the first activation spot (₦3k each, funded by the extra amount already paid). */
  autoBuySpots?: number;
}

export interface CreditDepositOpts {
  userId: string;
  paymentRef: string;
  amount: number;
  source: CreditSource;
  extraMetadata?: Record<string, unknown>;
  /** Auto-buy this many spots from the deposit wallet right after credit. */
  autoBuySpots?: number;
}


/**
 * Full activation flow:
 *  1. Record ₦0 membership_fee tracking tx
 *  2. Flip profile.is_member = true (only if not already)
 *  3. Credit deposit wallet with drop_entry_fee
 *  4. Trigger buy-spot for first spot
 *  5. Pay referrer activation bonus
 *  6. Send telegram alert (unless skipTelegram)
 *
 * Safe to call even if user already a member — the membership transaction
 * will still be recorded (for audit), but profile/spot/referral side-effects
 * are skipped.
 */
export async function creditMembership(
  supabase: SupabaseClient,
  opts: CreditMembershipOpts,
): Promise<{ activated: boolean }> {
  const { userId, paymentRef, paidAmount, source, extraMetadata = {}, email = null, skipTelegram, autoBuySpots = 0 } = opts;

  const { data: config } = await supabase
    .from('platform_config')
    .select('drop_entry_fee, referral_cash_bonus, membership_fee')
    .eq('id', 1)
    .single();
  const loopAmount = Number(config?.drop_entry_fee || 5000);
  const membershipFee = Number(config?.membership_fee || 5000);
  const referrerBonusAmt = Number(config?.referral_cash_bonus || 1000);

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_member, full_name, phone_number, referred_by_code')
    .eq('id', userId)
    .single();

  // 1. Always record the tracking tx (idempotency guaranteed by caller via alreadyProcessed)
  await supabase.from('transactions').insert({
    user_id: userId,
    wallet_type: 'earnings',
    amount: 0,
    transaction_type: 'membership_fee',
    description: 'Ad share activation (bank transfer)',
    payment_reference: paymentRef,
    status: 'completed',
    metadata: {
      payment_purpose: 'membership',
      processed_via: source,
      paid_amount: paidAmount,
      ...extraMetadata,
    },
  });

  // If user is already a member, stop here. We've recorded the payment but
  // we don't double-activate / double-credit a spot / double-pay referrer.
  if (profile?.is_member) {
    return { activated: false };
  }

  // 2. Flip membership flag
  await supabase.from('profiles').update({ is_member: true }).eq('id', userId);

  // 3. Credit first-spot fund
  const activationCreditRef = `${paymentRef}::activation_credit`;
  const { error: creditErr } = await supabase.from('transactions').insert({
    user_id: userId,
    wallet_type: 'deposit',
    amount: loopAmount,
    transaction_type: 'membership_bonus',
    description: 'Activation payment for your first ad share',
    status: 'completed',
    payment_reference: activationCreditRef,
    metadata: {
      purpose: 'spot_creation_credit',
      original_payment_ref: paymentRef,
      processed_via: source,
    },
  });


  // 3b. Record explicit platform margin ledger row (auditability):
  //     membership_fee - loopAmount - (referrer bonus if any) = platform take.
  //     Amount = 0 so it doesn't move wallets; metadata carries the split.
  const willPayReferrer =
    !!profile?.referred_by_code &&
    profile.referred_by_code !== 'SYSTEM' &&
    profile.referred_by_code !== '';
  const referrerCut = willPayReferrer ? referrerBonusAmt : 0;
  const platformMargin = Math.max(membershipFee - loopAmount - referrerCut, 0);
  await supabase.from('transactions').insert({
    user_id: userId,
    wallet_type: 'earnings',
    amount: 0,
    transaction_type: 'platform_margin',
    description: 'Membership split (platform margin)',
    status: 'completed',
    payment_reference: `${paymentRef}::platform_margin`,
    metadata: {
      purpose: 'platform_margin_audit',
      membership_fee: membershipFee,
      queue_and_first_spot: loopAmount,
      referrer_bonus: referrerCut,
      platform_margin: platformMargin,
      original_payment_ref: paymentRef,
      processed_via: source,
    },
  });

  // 4. Buy first spot — verify success before paying the referrer.
  //    P1-5 fix: previous fire-and-forget path could pay a referrer bonus for a
  //    referee whose spot creation failed silently.
  let firstSpotOk = false;
  if (!creditErr) {
    try {
      const resp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/buy-spot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          target_user_id: userId,
          source_wallet: 'deposit',
          skip_membership_check: true,
          idempotency_key: `activation::${paymentRef}::first_spot`,
        }),
      });
      const bodyText = await resp.text().catch(() => '');
      let bodyJson: Record<string, unknown> | null = null;
      try { bodyJson = bodyText ? JSON.parse(bodyText) : null; } catch { /* not json */ }
      firstSpotOk = resp.ok && (bodyJson?.success !== false);
      if (!firstSpotOk) {
        console.error('[credit-user] buy-spot returned non-success:', resp.status, bodyText);
      }
    } catch (e) {
      console.error('[credit-user] buy-spot fail:', e);
    }
  }

  // 4b. Auto-buy EXTRA shares on top of the first activation share.
  //     FLAT PRICING: every share costs the same (`drop_entry_fee` ===
  //     `membership_fee`), so the user has already paid loopAmount × extras
  //     on top of the first share. We credit that extra amount to the deposit
  //     wallet, then let runAutoBuySpots consume it.
  const extras = Math.max(0, Math.min(Number(autoBuySpots) || 0, 100));
  let extrasBought = 0;
  if (firstSpotOk && extras > 0) {
    try {
      const extrasCreditRef = `${paymentRef}::activation_extras_credit`;
      const extrasAmount = loopAmount * extras;
      await supabase.from('transactions').insert({
        user_id: userId,
        wallet_type: 'deposit',
        amount: extrasAmount,
        transaction_type: 'membership_bonus',
        description: `Activation top-up for ${extras} extra ad share${extras === 1 ? '' : 's'}`,
        status: 'completed',
        payment_reference: extrasCreditRef,
        metadata: {
          purpose: 'spot_creation_credit',
          original_payment_ref: paymentRef,
          processed_via: source,
          extras_count: extras,
        },
      });
      const { runAutoBuySpots } = await import('./autoBuySpots.ts');
      const extrasResult = await runAutoBuySpots(supabase, {
        userId,
        paymentRef: `${paymentRef}::extras`,
        count: extras,
      });
      extrasBought = Number(extrasResult?.bought || 0);
    } catch (e) {
      console.error('[credit-user] activation extras auto-buy failed:', e);
    }
  }

  // 5. Invite bonus — paid PER SHARE the friend activated on day one
  //    (only when the first share actually landed).
  const sharesActivated = 1 + extrasBought;
  if (
    firstSpotOk &&
    profile?.referred_by_code &&
    profile.referred_by_code !== 'SYSTEM' &&
    profile.referred_by_code !== ''
  ) {
    try {
      const { error: refErr } = await supabase.rpc('pay_referrer_activation_bonus', {
        _referee_id: userId,
        _referred_by_code: profile.referred_by_code,
        _shares: sharesActivated,
      });
      if (refErr) console.error('[credit-user] referral bonus fail:', refErr);
    } catch (e) {
      console.error('[credit-user] referral bonus threw:', e);
    }
  } else if (!firstSpotOk && profile?.referred_by_code) {
    console.warn('[credit-user] Skipping referral bonus — first-spot creation failed for', userId);
  }


  // 6. Telegram alert (skippable for admin-triggered paths if you prefer)
  if (!skipTelegram) {
    try {
      let referrerName: string | null = null;
      if (profile?.referred_by_code && profile.referred_by_code !== 'SYSTEM') {
        const { data: r } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('referral_code', profile.referred_by_code)
          .single();
        referrerName = r?.full_name ?? null;
      }
      await supabase.functions.invoke('send-telegram-alert', {
        body: {
          alertType: 'activation',
          userName: profile?.full_name || 'Unknown',
          userPhone: profile?.phone_number,
          userEmail: email,
          referrerCode: profile?.referred_by_code,
          referrerName,
          amount: paidAmount,
          referrerBonus: referrerBonusAmt,
          userId,
        },
      });
    } catch (e) {
      console.error('[credit-user] telegram alert fail:', e);
    }
  }

  return { activated: true };
}

/**
 * Simple wallet top-up: insert a completed deposit tx + send a friendly notification.
 */
export async function creditDeposit(
  supabase: SupabaseClient,
  opts: CreditDepositOpts,
): Promise<void> {
  const { userId, paymentRef, amount, source, extraMetadata = {}, autoBuySpots = 0 } = opts;

  await supabase.from('transactions').insert({
    user_id: userId,
    wallet_type: 'deposit',
    amount,
    transaction_type: 'deposit',
    description: 'Wallet deposit (bank transfer)',
    payment_reference: paymentRef,
    status: 'completed',
    metadata: {
      payment_purpose: 'deposit',
      processed_via: source,
      auto_buy_spots: autoBuySpots,
      ...extraMetadata,
    },
  });

  await supabase.from('notifications').insert({
    user_id: userId,
    notification_type: 'deposit_success',
    title: 'Money added!',
    message: `₦${amount.toLocaleString()} has been added to your wallet.`,
    metadata: { amount, payment_ref: paymentRef },
    link: '/wallets',
  });

  // Auto-buy spots from the freshly-credited deposit (if user asked for it).
  if (autoBuySpots && autoBuySpots > 0) {
    try {
      const { runAutoBuySpots } = await import('./autoBuySpots.ts');
      await runAutoBuySpots(supabase, { userId, paymentRef, count: autoBuySpots });
    } catch (e) {
      console.error('[creditDeposit] auto-buy spots failed:', e);
    }
  }

  // Auto-resume a pending restore-capacity intent. When a retired member
  // topped up via bank transfer / Moniepoint to cover their restore
  // shortfall, this is the ONLY thing that puts their spots back online —
  // without it they just have a fatter wallet and zero active spots.
  try {
    const { data: intent } = await supabase
      .from('pending_restore_intents')
      .select('count, total_cost, expires_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (intent && new Date(intent.expires_at).getTime() > Date.now()) {
      const [dep, earn] = await Promise.all([
        supabase.rpc('check_balance', { _user_id: userId, _wallet_type: 'deposit' }),
        supabase.rpc('check_balance', { _user_id: userId, _wallet_type: 'earnings' }),
      ]);
      const combined = Number(dep.data || 0) + Number(earn.data || 0);
      if (combined >= Number(intent.total_cost)) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const { runRestoreCapacity } = await import('./restoreCapacity.ts');
        const res = await runRestoreCapacity({
          supabase,
          userId,
          count: intent.count,
          supabaseUrl,
          serviceRoleKey,
        });
        console.log('[creditDeposit] restore-intent auto-resumed', {
          userId,
          bought: res.bought,
          requested: res.requested,
          errors: res.errors,
        });
      }
    } else if (intent) {
      // Expired intent — clean up so it doesn't clog the table.
      await supabase.from('pending_restore_intents').delete().eq('user_id', userId);
    }
  } catch (e) {
    console.error('[creditDeposit] restore-intent auto-resume failed:', e);
  }
}

