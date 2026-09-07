// Auto-buy spots after a successful deposit credit.
//
// Called by every payment path that credits the deposit wallet
// (flutterwave-webhook/callback, verify-payment, paystack-processor,
// moniepoint-webhook via creditDeposit, admin manual-credit paths).
//
// Idempotency: we insert a zero-amount "lock" transaction row with a
// deterministic payment_reference (`${paymentRef}::auto_buy_lock`). The
// unique constraint on payment_reference guarantees only ONE caller wins
// the race — every other path that tries to run auto-buy for the same
// deposit reference gets a 23505 and silently skips. This is the same
// pattern already used for activation_credit.

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export interface AutoBuySpotsOpts {
  userId: string;
  /** The deposit transaction's payment_reference. Used to build the lock key. */
  paymentRef: string;
  /** Number of spots the user asked us to auto-purchase. 0/undefined = no-op. */
  count: number;
}

export interface AutoBuySpotsResult {
  ran: boolean;
  requested: number;
  bought: number;
  skippedReason?: 'no_count' | 'duplicate_lock' | 'not_member' | 'banned' | 'system_paused';
  errors?: string[];
}

export async function runAutoBuySpots(
  supabase: SupabaseClient,
  opts: AutoBuySpotsOpts,
): Promise<AutoBuySpotsResult> {
  const { userId, paymentRef, count } = opts;
  const requested = Math.max(0, Math.min(Number(count) || 0, 100));

  if (requested <= 0) {
    return { ran: false, requested: 0, bought: 0, skippedReason: 'no_count' };
  }
  if (!userId || !paymentRef) {
    return { ran: false, requested, bought: 0, skippedReason: 'no_count' };
  }

  // ===== STEP 1: Idempotency lock =====
  const lockRef = `${paymentRef}::auto_buy_lock`;
  const { error: lockErr } = await supabase.from('transactions').insert({
    user_id: userId,
    wallet_type: 'deposit',
    amount: 0, // zero — balance unaffected
    transaction_type: 'deposit',
    description: 'Auto-activate ad shares lock',
    payment_reference: lockRef,
    status: 'completed',
    metadata: {
      purpose: 'auto_buy_spots_lock',
      original_payment_ref: paymentRef,
      requested,
    },
  });

  if (lockErr) {
    // 23505 = duplicate. Another path already started auto-buy for this ref.
    if ((lockErr as any).code === '23505' || lockErr.message?.includes('duplicate key')) {
      console.log(`[autoBuySpots] Already ran for ${paymentRef} — skipping`);
      return { ran: false, requested, bought: 0, skippedReason: 'duplicate_lock' };
    }
    console.error('[autoBuySpots] Lock insert failed:', lockErr);
    return { ran: false, requested, bought: 0, errors: [lockErr.message] };
  }

  // ===== STEP 2: Eligibility checks =====
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_member, is_banned, full_name')
    .eq('id', userId)
    .single();

  if (!profile?.is_member) {
    return { ran: true, requested, bought: 0, skippedReason: 'not_member' };
  }
  if (profile.is_banned) {
    return { ran: true, requested, bought: 0, skippedReason: 'banned' };
  }

  const { data: cfg } = await supabase
    .from('platform_config')
    .select('drop_system_active')
    .eq('id', 1)
    .single();

  if (!cfg?.drop_system_active) {
    return { ran: true, requested, bought: 0, skippedReason: 'system_paused' };
  }

  // ===== STEP 3: Loop buy-spot N times (sequential — each call uses claim_next_drop_position) =====
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const errors: string[] = [];
  let bought = 0;

  for (let i = 0; i < requested; i++) {
    let bailed = false;
    // Retry once on transient failure — empire mode can flip the buy-spot
    // branch (new-ticket vs extend) mid-loop if a concurrent distribution
    // retires the ticket. A clean second attempt against fresh state usually
    // succeeds without truncating the compound purchase.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/buy-spot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            target_user_id: userId,
            source_wallet: 'deposit',
            idempotency_key: `autobuy::${paymentRef}::${i}${attempt > 0 ? `::r${attempt}` : ''}`,
          }),
        });
        const result = await resp.json().catch(() => ({}));
        if (!resp.ok || result?.error) {
          const msg = result?.error || `HTTP ${resp.status}`;
          if (attempt === 0) {
            console.warn(`[autoBuySpots] transient buy-spot ${i + 1}/${requested} failed, retrying: ${msg}`);
            continue;
          }
          console.warn(`[autoBuySpots] buy-spot ${i + 1}/${requested} failed: ${msg}`);
          errors.push(msg);
          bailed = true;
          break;
        }
        bought++;
        break;
      } catch (e: any) {
        if (attempt === 0) {
          console.warn('[autoBuySpots] transient buy-spot exception, retrying:', e?.message);
          continue;
        }
        console.error('[autoBuySpots] buy-spot exception:', e);
        errors.push(e?.message || 'Unknown error');
        bailed = true;
        break;
      }
    }
    if (bailed) break;
  }


  // ===== STEP 4: Summary notification (single, not N) =====
  if (bought > 0) {
    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        notification_type: 'auto_spots_bought',
        title: bought === 1
          ? '1 ad share activated for you!'
          : `${bought} ad shares activated for you!`,
        message: bought === requested
          ? `We used your deposit to activate ${bought} ${bought === 1 ? 'ad share' : 'ad shares'} for you. Check your campaign progress!`
          : `We activated ${bought} of the ${requested} ${requested === 1 ? 'ad share' : 'ad shares'} you wanted. Top up to activate the rest.`,
        metadata: {
          requested,
          bought,
          payment_ref: paymentRef,
        },
        link: '/',
      });
    } catch (e) {
      console.error('[autoBuySpots] summary notification failed:', e);
    }
  }

  console.log(`[autoBuySpots] ${paymentRef}: bought ${bought}/${requested}`);
  return { ran: true, requested, bought, errors: errors.length ? errors : undefined };
}
