// Shared helper that performs the actual "restore capacity" checkout.
// Called from:
//   • the `restore-capacity` edge function (user-initiated 1-click)
//   • `credit-user.ts` `creditDeposit()` (auto-resume once a shortfall deposit lands)
//
// Guarantees:
//   • Deterministic lock row (`restore::${userId}::lock`) — unique constraint on
//     `transactions.payment_reference` blocks concurrent duplicate restores.
//   • Re-verifies `active_spots === 0` INSIDE the lock, not before it.
//   • On success, writes actual bought/charged into the lock metadata AND
//     deletes the lock so a future retirement can restore again.
//   • Deletes the pending_restore_intents row so the deposit webhook doesn't
//     re-trigger this after we've already run.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export interface RestoreCapacityArgs {
  supabase: SupabaseClient;
  userId: string;
  count: number;
  supabaseUrl: string;
  serviceRoleKey: string;
}

export interface RestoreCapacityResult {
  success: boolean;
  bought: number;
  requested: number;
  spots: Array<{ position: number; spot_id: string; cost: number }>;
  total_charged: number;
  errors?: string[];
  status?: number; // preferred HTTP status when returning from the edge fn
  error?: string;
  needs_deposit?: boolean;
  shortfall?: number;
  total_cost?: number;
  base_fee?: number;
  extra_fee?: number;
  deposit_balance?: number;
  earnings_balance?: number;
  already_active?: boolean;
  concurrent?: boolean;
}

export async function runRestoreCapacity({
  supabase,
  userId,
  count: requestedCount,
  supabaseUrl,
  serviceRoleKey,
}: RestoreCapacityArgs): Promise<RestoreCapacityResult> {
  const count = Math.max(1, Math.min(50, Math.floor(requestedCount)));

  // Eligibility snapshot
  const [profileRes, cfgRes, activeSpotsRes, depositRes, earningsRes] = await Promise.all([
    supabase.from('profiles').select('is_member, is_banned').eq('id', userId).single(),
    supabase.from('platform_config').select('membership_fee, drop_entry_fee, drop_system_active, drop_target_amount').eq('id', 1).single(),
    supabase.from('spots').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
    supabase.rpc('check_balance', { _user_id: userId, _wallet_type: 'deposit' }),
    supabase.rpc('check_balance', { _user_id: userId, _wallet_type: 'earnings' }),
  ]);

  if (profileRes.error || !profileRes.data) return err('Profile not found', 404);
  if (profileRes.data.is_banned) return err('Account suspended', 403);
  if (!profileRes.data.is_member) return err('You must be a member to activate another share', 403);
  if (cfgRes.error || !cfgRes.data) return err('Could not load platform settings', 500);
  if (!cfgRes.data.drop_system_active) return err('Campaigns are currently paused. Try again shortly.', 400);

  if ((activeSpotsRes.count ?? 0) > 0) {
    // Clean up any stale intent — user is already active via other means.
    await supabase.from('pending_restore_intents').delete().eq('user_id', userId);
    return { ...empty(count), already_active: true, status: 400, error: 'You still have an active share — no need to activate another.' };
  }

  const baseFee = Number(cfgRes.data.membership_fee ?? 5000);
  const extraFee = Number(cfgRes.data.drop_entry_fee ?? 5000);
  const payoutPerSpot = Number(cfgRes.data.drop_target_amount ?? 10000);
  const totalCost = baseFee + Math.max(0, count - 1) * extraFee;
  const depositBal = Number(depositRes.data || 0);
  const earningsBal = Number(earningsRes.data || 0);
  const combined = depositBal + earningsBal;

  if (combined < totalCost) {
    // Persist the intent so a future top-up auto-resumes this flow.
    await supabase.from('pending_restore_intents').upsert(
      {
        user_id: userId,
        count,
        total_cost: totalCost,
        base_fee: baseFee,
        extra_fee: extraFee,
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    return {
      ...empty(count),
      needs_deposit: true,
      shortfall: totalCost - combined,
      total_cost: totalCost,
      base_fee: baseFee,
      extra_fee: extraFee,
      deposit_balance: depositBal,
      earnings_balance: earningsBal,
    };
  }

  // ── Deterministic idempotency lock. Unique constraint on payment_reference
  // rejects concurrent duplicate restores with 23505.
  const lockRef = `restore::${userId}::lock`;
  const { error: lockErr } = await supabase.from('transactions').insert({
    user_id: userId,
    wallet_type: 'deposit',
    amount: 0,
    transaction_type: 'deposit',
    description: 'Activate another share lock',
    payment_reference: lockRef,
    status: 'completed',
    metadata: { purpose: 'restore_capacity_lock', count, total_cost: totalCost },
  });
  if (lockErr) {
    const code = (lockErr as { code?: string }).code;
    if (code === '23505') {
      return { ...empty(count), concurrent: true, status: 409, error: 'Activating another share is already in progress. Please wait a moment.' };
    }
    console.error('[runRestoreCapacity] lock error', lockErr);
    return err('Could not activate another share. Please try again.', 500);
  }

  // Double-check active_spots === 0 AFTER lock is held (P0-2 race window).
  const { count: postLockActive } = await supabase
    .from('spots')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active');
  if ((postLockActive ?? 0) > 0) {
    await supabase.from('transactions').delete().eq('payment_reference', lockRef);
    await supabase.from('pending_restore_intents').delete().eq('user_id', userId);
    return { ...empty(count), already_active: true, status: 400, error: 'You already have an active share.' };
  }

  // P1-3: Re-verify ban status AFTER any async top-up / auto-resume delay.
  // The eligibility snapshot above may be seconds-to-minutes stale when this
  // helper is invoked from `creditDeposit()` auto-resume after a webhook lands.
  const { data: freshProfile } = await supabase
    .from('profiles')
    .select('is_banned, is_member')
    .eq('id', userId)
    .single();
  if (freshProfile?.is_banned || !freshProfile?.is_member) {
    await supabase.from('transactions').delete().eq('payment_reference', lockRef);
    await supabase.from('pending_restore_intents').delete().eq('user_id', userId);
    return { ...empty(count), status: 403, error: freshProfile?.is_banned ? 'Account suspended' : 'Membership required' };
  }

  // ── Sequential spot creation — earnings first, then deposit.
  const boughtSpots: Array<{ position: number; spot_id: string; cost: number }> = [];
  let remainingEarnings = earningsBal;
  let remainingDeposit = depositBal;
  const errors: string[] = [];

  // Track the ACTUAL final line target from the RPC so the "restored" toast
  // reflects reality instead of a possibly stale platform_config snapshot.
  let actualFinalTarget = 0;

  for (let i = 0; i < count; i++) {
    const feeThis = i === 0 ? baseFee : extraFee;
    let wallet: 'earnings' | 'deposit';
    if (remainingEarnings >= feeThis) {
      wallet = 'earnings';
      remainingEarnings -= feeThis;
    } else if (remainingDeposit >= feeThis) {
      wallet = 'deposit';
      remainingDeposit -= feeThis;
    } else {
      errors.push(`Ran out of wallet balance on spot ${i + 1}`);
      break;
    }

    // Retry once on transient failure — empire mode can flip buy-spot's
    // new-ticket vs extend branch mid-loop if another purchase races us.
    let attemptResult: {
      ok: boolean;
      error?: string;
      position?: number;
      spot_id?: string;
      new_target?: number;
    } = { ok: false };

    for (let attempt = 0; attempt < 2 && !attemptResult.ok; attempt++) {
      const resp = await fetch(`${supabaseUrl}/functions/v1/buy-spot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({
          target_user_id: userId,
          source_wallet: wallet,
          fee_override: feeThis,
          spot_label: i === 0 ? 'New Ad Share 1' : `New Ad Share ${i + 1}`,
          idempotency_key: `restore::${userId}::${lockRef}::${i}${attempt > 0 ? `::r${attempt}` : ''}`,
        }),
      });
      const result = await resp.json().catch(() => ({}));
      if (!resp.ok || result?.error) {
        attemptResult = { ok: false, error: result?.error || `HTTP ${resp.status}` };
        if (attempt === 0) {
          console.warn(`[restoreCapacity] transient buy-spot ${i + 1}/${count} failed, retrying: ${attemptResult.error}`);
        }
        continue;
      }
      attemptResult = {
        ok: true,
        position: result.position,
        spot_id: result.spot_id,
        new_target: Number(result.new_target ?? 0),
      };
    }

    if (!attemptResult.ok) {
      errors.push(attemptResult.error || 'buy-spot failed');
      break;
    }
    boughtSpots.push({ position: attemptResult.position!, spot_id: attemptResult.spot_id!, cost: feeThis });
    if (attemptResult.new_target && attemptResult.new_target > actualFinalTarget) {
      actualFinalTarget = attemptResult.new_target;
    }
  }


  const totalCharged = boughtSpots.reduce((s, x) => s + x.cost, 0);

  // Update the lock row with the actual outcome so reconciliation/support can
  // find partial-failure restores.
  await supabase
    .from('transactions')
    .update({
      metadata: {
        purpose: 'restore_capacity_lock',
        count,
        requested: count,
        actual_bought: boughtSpots.length,
        actual_charged: totalCharged,
        errors,
        completed_at: new Date().toISOString(),
      },
    })
    .eq('payment_reference', lockRef);

  // If we bought at least one spot, remove the deterministic lock so the user
  // can restore again in a future retirement cycle. If nothing was bought,
  // leave it in place briefly (it acts as a 5-minute cooldown against retry
  // storms) — a small helper cron in `expire_stale_payment_attempts` can
  // clear it, but for now we clear on any partial success too.
  if (boughtSpots.length > 0) {
    await supabase.from('transactions').delete().eq('payment_reference', lockRef);
    await supabase.from('pending_restore_intents').delete().eq('user_id', userId);

    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        notification_type: 'spots_restored',
        title:
          boughtSpots.length === count
            ? `Welcome back — ${count} ad share${count === 1 ? '' : 's'} activated!`
            : `Activated ${boughtSpots.length} of ${count} ad shares`,
        message: (() => {
          // Prefer the ACTUAL empire target reported by buy-spot; fall back to
          // per-spot × count if the RPC didn't echo new_target (first spot).
          const finalTarget = actualFinalTarget > 0
            ? actualFinalTarget
            : payoutPerSpot * boughtSpots.length;
          return `Your campaign is live again. It pays ₦${finalTarget.toLocaleString()} when it reaches 100%.`;
        })(),
        link: '/',
      });
    } catch (_) {
      /* non-critical */
    }
  }

  return {
    success: boughtSpots.length > 0,
    bought: boughtSpots.length,
    requested: count,
    spots: boughtSpots,
    total_charged: totalCharged,
    errors: errors.length ? errors : undefined,
  };
}

function empty(count: number): RestoreCapacityResult {
  return { success: false, bought: 0, requested: count, spots: [], total_charged: 0 };
}

function err(message: string, status: number): RestoreCapacityResult {
  return { ...empty(0), error: message, status };
}
