import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isServiceRoleCall(req: Request): boolean {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  // This money-moving engine is internal-only. Normal user JWTs and anonymous
  // requests must never be able to start a distribution run.
  return token.length > 0 && token === supabaseServiceKey;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// ==========================================
// RETRY CONFIG & HELPERS
// ==========================================
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  retryableErrors: [
    'connection', 'timeout', 'deadlock', 'serialization', 
    'too many connections', 'ECONNREFUSED', 'ETIMEDOUT',
    'statement timeout', 'lock timeout'
  ],
};

// Track processed distributions to prevent double-processing
const processedDistributions = new Map<string, { timestamp: number; result: DistributionResult }>();
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000; // 5 minutes

function isRetryableError(error: Error | string): boolean {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const lowerMessage = errorMessage.toLowerCase();
  return RETRY_CONFIG.retryableErrors.some(e => lowerMessage.includes(e.toLowerCase()));
}

function calculateBackoff(attempt: number): number {
  const exponentialDelay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, RETRY_CONFIG.maxDelayMs);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function flushAuditRecords(records: Record<string, unknown>[]): Promise<void> {
  if (!records.length) return;
  try {
    const { error } = await supabase.from('drop_fill_audit_log').insert(records);
    if (error) console.warn('Audit log flush failed:', error.message);
  } catch (e) {
    console.warn('Audit log flush threw:', (e as Error).message);
  } finally {
    records.length = 0;
  }
}

function cleanupIdempotencyCache(): void {
  const now = Date.now();
  for (const [key, value] of processedDistributions.entries()) {
    if (now - value.timestamp > IDEMPOTENCY_TTL_MS) {
      processedDistributions.delete(key);
    }
  }
}

function getIdempotencyKey(originDropId: string, amount: number): string {
  return `${originDropId}:${amount}`;
}

// ==========================================
// TYPES: Generic Write Commands
// ==========================================
interface PlatformConfig {
  drop_entry_fee: number;
  drop_queue_contribution: number;
  drop_target_amount: number;
  drop_system_active: boolean;
  distribution_active: boolean;
}

interface DropData {
  drop_id: string;
  fill_amount: number;
  target_amount: number;
  position: number;
  status: string;
  source_type: string;
  spot_id: string;
  owner_id: string;
  spot_name: string;
  owner_name: string;
  auto_compound_enabled: boolean;
  referred_by_code: string | null;
  referral_code: string;
  // first_cycle_completed_at column removed — every cycle pays the same flat profit now.
  last_payout_at: string | null;
  active_referrals_count: number;
  referrer_id: string | null;
  deposit_balance: number;
  earnings_balance: number;
  pending_balance: number;
  user_spot_count: number;
}

// ==========================================
// GENERIC WRITE COMMAND: Edge Function defines EVERYTHING
// ==========================================
interface WriteCommand {
  op: 'insert' | 'update' | 'delete' | 'rpc';
  table?: string;
  data?: Record<string, unknown>;
  set?: Record<string, unknown>;
  where?: Record<string, unknown>;
  function?: string;
  args?: Record<string, unknown>;
}

interface DistributionResult {
  success: boolean;
  distributed: number;
  payouts_made: number;
  reentries_made: number;
  recycled_count: number;
  total_recycled: number;
  remaining: number;
  depth: number;
  auto_compounds_triggered: number;
  spots_bought: number;
  paused?: boolean;
}

// NOTE: The old per-cycle referral royalty was removed in the Retirement
// Economy V1 migration. Referrers are paid a one-time ₦1,000 bonus at
// activation (see pay_referrer_activation_bonus RPC), and nothing else.
// Do NOT reintroduce recurring per-cycle commissions here.

// ==========================================
// PAYOUT GATE
// Velocity tiers were removed — every completed cycle now pays out. The
// gating functions (getUserVelocityTier / canUserReceivePayout) and the
// recycle/overflow branch they fed are gone. If gating ever comes back,
// reintroduce both here and the `else` branch in distributeLiquidity.
// ==========================================

// ==========================================
// PROFIT CALCULATION (Retirement Economy — Empire mode)
// ==========================================
// The lump-sum payout equals the actual target_amount on the ticket, which
// under empire mode grows by +drop_target_amount every time the user buys an
// extra spot. So a ticket with 4 spots (₦40k target) pays out ₦40k, not the
// default ₦10k config baseline.
function calculateUserProfit(config: PlatformConfig, drop: { target_amount: number; drop_id?: string }): number {
  const t = Number(drop?.target_amount);
  if (!(t > 0)) {
    // A drop with a zero/NaN target is data corruption (bad migration, manual
    // SQL mistake, etc.). Silently falling back to the config baseline would
    // retire an empire for the wrong amount. Refuse loudly so the pulse skips
    // this drop and the operator sees it in the logs.
    throw new Error(`[calculateUserProfit] Invalid target_amount for drop ${drop?.drop_id ?? '(unknown)'}: ${drop?.target_amount}`);
  }
  return t;
}


// NOTE: There is no admin/treasury fee insert. The platform's actual cut
// is the implicit (membership_fee - drop_entry_fee - referral_cash_bonus)
// captured at activation, plus (drop_entry_fee - drop_queue_contribution)
// captured on every extension spot purchase.

// ==========================================
// BALANCE TRACKING
// ==========================================
interface UserBalanceTracker {
  deposit: number;
  earnings: number;
  spotCount: number;
}

// ==========================================
// MAIN DISTRIBUTION LOGIC
// ==========================================
async function distributeLiquidity(
  originDropId: string,
  amount: number,
  maxDepth: number = 100
): Promise<DistributionResult> {
  console.log(`⚡ distribute-liquidity: Starting distribution of ₦${amount} from drop ${originDropId}`);

  // ===== AUDIT: distribution_started =====
  await supabase.from('drop_fill_audit_log').insert({
    origin_drop_id: originDropId,
    event_type: 'distribution_started',
    amount,
    metadata: { max_depth: maxDepth },
  }).then(
    () => {},
    (e: Error) => console.warn('Audit log (started) failed:', e?.message),
  );

  // Step 1: FETCH all data in ONE call
  const { data: distData, error: fetchError } = await supabase
    .rpc('get_distribution_data', {
      _origin_drop_id: originDropId,
      _max_drops: maxDepth
    });
  
  if (fetchError) {
    console.error('❌ Failed to fetch distribution data:', fetchError);
    await supabase.from('drop_fill_audit_log').insert({
      origin_drop_id: originDropId,
      event_type: 'error',
      error_message: `fetch_failed: ${fetchError.message}`,
    }).then(() => {}, () => {});
    throw new Error(`Failed to fetch distribution data: ${fetchError.message}`);
  }
  
  const config = distData.config as PlatformConfig;
  const drops = distData.drops as DropData[];
  let currentMaxPosition = distData.current_max_position as number;

  // Admin-configurable Empire Builder cap (defaults to 1 if column/value missing).
  let maxAutoBuysPerPulse = 1;
  try {
    const { data: capRow } = await supabase
      .from('platform_config')
      .select('max_auto_buys_per_pulse')
      .eq('id', 1)
      .maybeSingle();
    const v = (capRow as { max_auto_buys_per_pulse?: number } | null)?.max_auto_buys_per_pulse;
    if (typeof v === 'number' && v > 0) maxAutoBuysPerPulse = Math.floor(v);
  } catch (_e) {
    // Keep default of 1
  }
  
  // ========== CHECK IF DISTRIBUTION IS ACTIVE ==========
  // If distribution is OFF, exit early - money stays with the spot, not distributed
  if (config.distribution_active === false) {
    console.log('⏸️ Distribution is OFF - money stays with the spot, not distributed');
    return {
      success: true,
      distributed: 0,
      payouts_made: 0,
      reentries_made: 0,
      recycled_count: 0,
      total_recycled: 0,
      remaining: amount,
      depth: 0,
      auto_compounds_triggered: 0,
      spots_bought: 0,
      paused: true,
    };
  }
  
  console.log(`📊 Fetched ${drops.length} unfilled drops, max position: ${currentMaxPosition}`);
  
  // Step 2: CALCULATE all distributions and build commands
  const commands: WriteCommand[] = [];
  
  // Track expected balances per user
  const userBalances: Map<string, UserBalanceTracker> = new Map();
  
  // Initialize user balances from fetched data
  for (const drop of drops) {
    if (!userBalances.has(drop.owner_id)) {
      userBalances.set(drop.owner_id, {
        deposit: drop.deposit_balance || 0,
        earnings: drop.earnings_balance || 0,
        spotCount: drop.user_spot_count || 1,
      });
    }
  }
  
  let remaining = amount;
  let distributed = 0;
  let payoutsMade = 0;
  let reentriesMade = 0;
  // Legacy fields, always 0 since velocity tiers were removed.
  // Kept in the response shape for backward compatibility with callers.
  const recycledCount = 0;
  const totalRecycled = 0;
  let depth = 0;
  let autoCompoundsTriggered = 0;
  // Daily Task: collect owner IDs that received a real payout this run
  // so we can promote their Pending balance into Withdrawable after commit.
  const paidOutOwners = new Set<string>();
  let spotsBought = 0;

  const autoCompoundUsers = new Set<string>();
  
  // (Retirement model: spots are removed from queue after their one payout,
  // so we no longer track re-entry duplicates.)

  // Audit records collected during this run, flushed in bulk after commit.
  const auditRecords: Record<string, unknown>[] = [];
  
  for (const drop of drops) {
    if (remaining <= 0 || depth >= maxDepth) break;
    depth++;

    // Data-integrity guard: a drop with a zero/negative target is corrupt
    // (should never happen in practice). Skip it loudly instead of retiring
    // the owner's empire for ₦0 or crashing the whole pulse.
    if (!(Number(drop.target_amount) > 0)) {
      console.error(`⚠️ Skipping drop ${drop.drop_id} (pos ${drop.position}, owner ${drop.owner_id}): invalid target_amount=${drop.target_amount}`);
      auditRecords.push({
        origin_drop_id: originDropId,
        event_type: 'skipped_invalid_target',
        drop_id: drop.drop_id,
        spot_id: drop.spot_id,
        owner_id: drop.owner_id,
        owner_name: drop.owner_name,
        position: drop.position,
        amount: 0,
        metadata: { target_amount: drop.target_amount },
      });
      continue;
    }

    
    const amountToFill = Math.min(remaining, drop.target_amount - drop.fill_amount);
    const newFillAmount = drop.fill_amount + amountToFill;
    
    remaining -= amountToFill;
    distributed += amountToFill;

    // Audit: every fill we make against a drop
    auditRecords.push({
      origin_drop_id: originDropId,
      event_type: 'fill',
      drop_id: drop.drop_id,
      spot_id: drop.spot_id,
      owner_id: drop.owner_id,
      owner_name: drop.owner_name,
      position: drop.position,
      amount: amountToFill,
      metadata: {
        previous_fill: drop.fill_amount,
        new_fill: newFillAmount,
        target: drop.target_amount,
        completed: newFillAmount >= drop.target_amount,
      },
    });
    
    if (newFillAmount >= drop.target_amount) {
      const hasReferrer = !!(drop.referred_by_code &&
                            drop.referred_by_code !== '' &&
                            drop.referred_by_code !== 'SYSTEM');

      const userProfit = calculateUserProfit(config, drop);

      console.log(`Drop ${drop.position} (${drop.owner_name}): completed, profit=₦${userProfit}`);

      // Update drop fill
      commands.push({
        op: 'update',
        table: 'drops',
        set: {
          fill_amount: newFillAmount,
          status: 'completed',
          completed_at: new Date().toISOString(),
        },
        where: { id: drop.drop_id },
      });

      // Empire mode: cycle stats + earnings are updated on ALL of the user's
      // active spots (base + extensions) by retire_all_active_spots below.
      // No per-spot update_spot_stats here — it would double-count.

      {
        payoutsMade++;

        auditRecords.push({
          origin_drop_id: originDropId,
          event_type: 'payout',
          drop_id: drop.drop_id,
          spot_id: drop.spot_id,
          owner_id: drop.owner_id,
          owner_name: drop.owner_name,
          position: drop.position,
          amount: userProfit,
          payout_made: true,
          metadata: {
            has_referrer: hasReferrer,
          },
        });

        // ====================================================
        // NEW RULE: Pay user from THEIR OWN PENDING WALLET only.
        // Drop liquidity (₦1,000) is NOT given to the user — it
        // continues into the cascade as the re-entry fee below.
        // ====================================================
        commands.push({
          op: 'rpc',
          function: 'consume_pending_for_cycle',
          args: {
            _user_id: drop.owner_id,
            _profit_target: userProfit,
            _spot_id: drop.spot_id,
            _drop_id: drop.drop_id,
          },
        });
        paidOutOwners.add(drop.owner_id);

        // ===== HARVEST MISSED detection =====
        // Snapshot-based: if the user's pending wallet is short of the cycle target,
        // they will only collect what they have. Tell them, with no excuses.
        const pendingSnapshot = Math.max(0, Number(drop.pending_balance ?? 0));
        const expectedPaid = Math.min(userProfit, pendingSnapshot);
        const forfeited = userProfit - expectedPaid;
        if (forfeited > 0) {
          const isFullMiss = expectedPaid <= 0;
          const title = isFullMiss
            ? 'Your ad share cashed out empty'
            : 'Your ad share cashed out light';
          // Retirement model: this spot has now paid its ONE payout and retired.
          // There is no "next turn" — the only way to earn again is to restore
          // a fresh spot. Copy must reflect that finality.
          const message = isFullMiss
            ? `Your campaign reached 100% but your task basket was empty, so your ad share collected ₦0 of the ₦${userProfit.toLocaleString()} it could have paid. That share is now finished. Activate another share to start earning again — and do your daily picture rating so the next one pays in full.`
            : `Your campaign reached 100% but your task basket only had ₦${expectedPaid.toLocaleString()}, so you missed out on ₦${forfeited.toLocaleString()}. That share is now finished. Activate another share to earn again — and do your daily picture rating so the next one pays in full.`;

          commands.push({
            op: 'insert',
            table: 'notifications',
            data: {
              user_id: drop.owner_id,
              notification_type: 'missed_harvest',
              title,
              message,
              link: '/dashboard?restore=1',
              metadata: JSON.stringify({
                show_as_modal: true,
                icon_template: 'bell',
                cta_button_text: 'Activate another share',
                cta_button_link: '/dashboard?restore=1',
                spot_id: drop.spot_id,
                drop_id: drop.drop_id,
                position: drop.position,
                target: userProfit,
                paid: expectedPaid,
                forfeited,
              }),
            },
          });

          auditRecords.push({
            origin_drop_id: originDropId,
            event_type: 'missed_harvest',
            drop_id: drop.drop_id,
            spot_id: drop.spot_id,
            owner_id: drop.owner_id,
            owner_name: drop.owner_name,
            position: drop.position,
            amount: forfeited,
            metadata: { target: userProfit, paid: expectedPaid, forfeited },
          });
        }

        // (Cycle referral royalty removed in Retirement Economy V1.
        // Referrer got their ₦1,000 bonus at activation.)

        // NORMAL PATH: user already paid via consume_pending_for_cycle RPC above.
        {
          const userBal = userBalances.get(drop.owner_id)!;
          // NOTE: We intentionally do NOT add userProfit to userBal.earnings here.
          // consume_pending_for_cycle pays only what's actually in the pending wallet,
          // which may be less than the target profit. Auto-compound must spend only
          // proven-existing earnings (snapshot from cached_balances). Profit credited
          // this pulse will be picked up on the next pulse — safer, prevents overspend.

          // EMPIRE BUILDER (auto-compound): Buy spots from earnings
          // Hard cap: at most N new spots per user per distribution pulse (admin-configurable).
          const MAX_AUTO_BUYS_PER_PULSE = maxAutoBuysPerPulse;
          if (drop.auto_compound_enabled &&
              config.distribution_active !== false &&
              userBal.earnings >= config.drop_entry_fee &&
              !autoCompoundUsers.has(drop.owner_id)) {
            autoCompoundUsers.add(drop.owner_id);
            autoCompoundsTriggered++;

            let userSpotsBought = 0;
            const maxBuys = Math.min(
              Math.floor(userBal.earnings / config.drop_entry_fee),
              MAX_AUTO_BUYS_PER_PULSE,
            );

            // Empire mode: auto-compound creates ONE new ticket at the tail,
            // then folds any extra affordable spots as extensions on the same
            // ticket (target = N × drop_target_amount). This keeps "one active
            // ticket per user" and matches the manual buy-spot behaviour.
            let newTicketDropId: string | null = null;
            let newTicketPosition: number | null = null;
            while (userSpotsBought < maxBuys && userBal.earnings >= config.drop_entry_fee) {
              const newSpotId = crypto.randomUUID();
              const spotNumber = userBal.spotCount + 1;
              const isFirst = newTicketDropId === null;

              // Deduct from earnings
              commands.push({
                op: 'insert',
                table: 'transactions',
                data: {
                  user_id: drop.owner_id,
                  amount: -config.drop_entry_fee,
                  transaction_type: 'drop_entry',
                  wallet_type: 'earnings',
                  description: isFirst
                    ? `Spot ${spotNumber} (Empire Builder)`
                    : `Spot ${spotNumber} (Empire Builder — extension)`,
                  status: 'completed',
                  metadata: JSON.stringify({ auto_compound: true, is_extension: !isFirst }),
                },
              });

              // Create spot row (base = first; rest are extensions).
              commands.push({
                op: 'insert',
                table: 'spots',
                data: {
                  id: newSpotId,
                  user_id: drop.owner_id,
                  spot_name: `Spot ${spotNumber}`,
                  status: 'active',
                  total_cycles: 0,
                  total_earnings: 0,
                  is_extension: !isFirst,
                },
              });

              if (isFirst) {
                currentMaxPosition++;
                newTicketPosition = currentMaxPosition;
                newTicketDropId = crypto.randomUUID();
                commands.push({
                  op: 'insert',
                  table: 'drops',
                  data: {
                    id: newTicketDropId,
                    spot_id: newSpotId,
                    user_id: drop.owner_id,
                    position: newTicketPosition,
                    status: 'waiting',
                    fill_amount: 0,
                    target_amount: config.drop_target_amount,
                    source_type: 'new',
                    is_settled: false,
                  },
                });
              } else {
                // Grow the same ticket's target by another ₦10k.
                commands.push({
                  op: 'rpc',
                  function: 'extend_drop_target',
                  args: {
                    _drop_id: newTicketDropId,
                    _delta: config.drop_target_amount,
                  },
                });
              }

              userBal.earnings -= config.drop_entry_fee;
              userBal.spotCount++;
              userSpotsBought++;
              spotsBought++;

              // Retirement model: only the queue-contribution slice cascades
              // into the pool (rest is the platform's silent profit).
              remaining += Number(config.drop_queue_contribution ?? config.drop_entry_fee);

              console.log(`🔄 Empire Builder: ${drop.owner_name} bought Spot ${spotNumber}${isFirst ? '' : ' (extension)'}`);
            }

            // Notification
            if (userSpotsBought > 0) {
              commands.push({
                op: 'insert',
                table: 'notifications',
                data: {
                  user_id: drop.owner_id,
                  notification_type: 'auto_compound_purchase',
                  title: userSpotsBought === 1
                    ? 'Empire Builder bought you a new spot'
                    : `Empire Builder bought you ${userSpotsBought} new spots`,
                  message: `Your profits are compounding! You now have ${userBal.spotCount} spots in total.`,
                },
              });
            }
          }
        }


        // Update last_payout_at
        commands.push({
          op: 'update',
          table: 'profiles',
          set: { last_payout_at: new Date().toISOString() },
          where: { id: drop.owner_id },
        });

        // Mark drop as paid
        commands.push({
          op: 'update',
          table: 'drops',
          set: { status: 'paid', paid_at: new Date().toISOString() },
          where: { id: drop.drop_id },
        });
      }

      // ==========================================================
      // RETIREMENT (Empire mode): the ticket has hit its full target,
      // so ALL of the user's active spots — the base spot and every
      // extension bought after it — retire together in a single call.
      // No re-entry drop is created; the queue moves on.
      // ==========================================================
      commands.push({
        op: 'rpc',
        function: 'retire_all_active_spots',
        args: {
          _user_id: drop.owner_id,
          _profit: userProfit,
        },
      });

      commands.push({
        op: 'insert',
        table: 'notifications',
        data: {
          user_id: drop.owner_id,
          notification_type: 'spot_retired',
          title: `${drop.spot_name} completed its cycle`,
          message: `Your spot has finished and been retired. Buy another spot to keep earning.`,
          link: '/dashboard',
        },
      });

      auditRecords.push({
        origin_drop_id: originDropId,
        event_type: 'spot_retired',
        drop_id: drop.drop_id,
        spot_id: drop.spot_id,
        owner_id: drop.owner_id,
        owner_name: drop.owner_name,
        position: drop.position,
      });

      // Overflow handling — any leftover from over-filling this drop
      // continues cascading down the queue.
      const overflow = newFillAmount - drop.target_amount;
      if (overflow > 0) {
        remaining += overflow;
      }
    } else {
      // Drop not complete, just update fill
      commands.push({
        op: 'update',
        table: 'drops',
        set: { fill_amount: newFillAmount, status: 'filling' },
        where: { id: drop.drop_id },
      });
    }
  }

  // ==========================================
  // PRE-TURN WARNINGS: "Your turn is almost here"
  // For drops we did NOT complete this pulse (the next folks in line),
  // if their pending basket is short of the cycle target, warn them once per day.
  // ==========================================
  try {
    const completedThisPulse = new Set<string>();
    for (const c of commands) {
      if (c.op === 'update' && c.table === 'drops' && c.set?.status === 'completed') {
        const id = (c.where as { id?: string } | undefined)?.id;
        if (id) completedThisPulse.add(id);
      }
    }
    // Africa/Lagos local date (UTC+1, no DST)
    const lagosToday = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);

    // Empire mode: each ticket has its OWN target (10k × spots on it). The
    // warning trigger compares each drop's pending balance to that specific
    // target, not a global config value.
    //
    // IMPORTANT: only warn drops that are actually near the front of the
    // queue. `drops` is sorted by position ASC in get_distribution_data, so
    // the first N entries (excluding ones we just completed) are the real
    // "almost your turn" candidates. Anyone further back gets a false-alarm
    // "your one payout is almost here" — we now skip them entirely.
    const NEAR_FRONT_LIMIT = 3;
    // A drop is only "near its turn" when it is BOTH near the front of the
    // queue AND actually close to being fully filled. Under the empire model a
    // fresh drop sits at position 1 the moment it starts filling, so gating on
    // position alone spams users at 5%–20% fill with "your turn is almost here"
    // — a lie. Require fill >= 70% before firing any pre-turn warning.
    const NEAR_FILL_MIN_PCT = 70;
    const nearFront = drops
      .filter(d => !completedThisPulse.has(d.drop_id))
      .slice(0, NEAR_FRONT_LIMIT);

    const warningCandidates = nearFront
      .filter(d => {
        const target = Number(d.target_amount ?? 0);
        const filled = Number(d.fill_amount ?? 0);
        const pct = target > 0 ? (filled / target) * 100 : 0;
        if (pct < NEAR_FILL_MIN_PCT) return false;
        return Number(d.pending_balance ?? 0) < calculateUserProfit(config, d);
      });

    if (warningCandidates.length > 0) {
      const spotIds = warningCandidates.map(d => d.spot_id);
      const { data: alreadyWarned } = await supabase
        .from('harvest_warnings')
        .select('spot_id')
        .in('spot_id', spotIds)
        .eq('warn_date', lagosToday);
      const warnedSet = new Set((alreadyWarned || []).map((r: { spot_id: string }) => r.spot_id));

      // Rank within the surviving queue → "peopleAhead" is the count of
      // uncompleted drops that sit strictly in front of this drop.
      const rankMap = new Map<string, number>();
      nearFront.forEach((d, idx) => rankMap.set(d.drop_id, idx));

      for (const d of warningCandidates) {
        if (warnedSet.has(d.spot_id)) continue;
        const targetProfit = calculateUserProfit(config, d);
        const pending = Math.max(0, Number(d.pending_balance ?? 0));
        const shortfall = targetProfit - pending;
        const peopleAhead = rankMap.get(d.drop_id) ?? 0;
        const isNext = peopleAhead === 0;
        const positionLabel = isNext
          ? "You're next in line"
          : `Only ${peopleAhead} ${peopleAhead === 1 ? 'person is' : 'people are'} ahead of you`;

        commands.push({
          op: 'insert',
          table: 'harvest_warnings',
          data: {
            user_id: d.owner_id,
            spot_id: d.spot_id,
            warn_date: lagosToday,
          },
        });

        commands.push({
          op: 'insert',
          table: 'notifications',
          data: {
            user_id: d.owner_id,
            notification_type: 'turn_approaching',
            title: isNext ? "You're next in line!" : 'Your payout is almost here!',
            message: pending <= 0
              ? `${positionLabel}, but your pending balance is empty. When your turn hits your spot pays ₦0 out of a possible ₦${targetProfit.toLocaleString()}. Do your tasks now to lock in the full payout — you only get one shot on this spot.`
              : `${positionLabel}. Your pending balance only has ₦${pending.toLocaleString()} — you're short ₦${shortfall.toLocaleString()}. When your turn hits your spot pays only ₦${pending.toLocaleString()} out of ₦${targetProfit.toLocaleString()}. Do tasks now to lock in the full amount.`,
            link: '/task',
            metadata: JSON.stringify({
              show_as_modal: true,
              icon_template: 'bell',
              cta_button_text: 'Do tasks now',
              cta_button_link: '/task',
              spot_id: d.spot_id,
              people_ahead: peopleAhead,
              pending,
              target: targetProfit,
              shortfall,
            }),
          },
        });




        auditRecords.push({
          origin_drop_id: originDropId,
          event_type: 'turn_approaching_warned',
          drop_id: d.drop_id,
          spot_id: d.spot_id,
          owner_id: d.owner_id,
          owner_name: d.owner_name,
          position: d.position,
          metadata: { pending, target: targetProfit, shortfall, people_ahead: peopleAhead },
        });
      }
    }
  } catch (e) {
    console.warn('Pre-turn warning step failed:', (e as Error).message);
  }

  // Cache is auto-refreshed by trigger on transactions insert — no manual refresh needed.


  console.log(`📦 Commands prepared: ${commands.length} total`);
  console.log(`📦 Auto-compounds: ${autoCompoundsTriggered}, Spots bought: ${spotsBought}`);

  // ==========================================
  // PRE-COMMIT GUARD: verify each drop we're about to mark 'completed' still
  // has the exact target_amount we snapshotted. Empire mode lets users extend
  // their ticket mid-run (extend_line_ticket takes a row lock and bumps
  // target_amount). If that happened between our read and this commit, our
  // computed profit is stale and we'd retire the empire for less than the
  // user paid for. Abort the completion for that drop and let the next
  // distribution pulse pick it up with fresh numbers.
  // ==========================================
  try {
    const completingIds: { id: string; snapshotTarget: number }[] = [];
    for (const c of commands) {
      if (c.op === 'update' && c.table === 'drops' && (c.set as { status?: string } | undefined)?.status === 'completed') {
        const id = (c.where as { id?: string } | undefined)?.id;
        if (!id) continue;
        const src = drops.find(d => d.drop_id === id);
        if (src) completingIds.push({ id, snapshotTarget: Number(src.target_amount) });
      }
    }
    if (completingIds.length > 0) {
      const { data: fresh } = await supabase
        .from('drops')
        .select('id, target_amount')
        .in('id', completingIds.map(x => x.id));
      const freshMap = new Map((fresh || []).map((r: { id: string; target_amount: number }) => [r.id, Number(r.target_amount)]));
      const stale = new Set<string>();
      for (const { id, snapshotTarget } of completingIds) {
        const now = freshMap.get(id);
        if (now != null && Math.abs(now - snapshotTarget) > 0.01) {
          console.warn(`⚠️ Drop ${id} target changed mid-pulse (${snapshotTarget} → ${now}). Skipping completion; next pulse will handle it.`);
          stale.add(id);
        }
      }
      if (stale.size > 0) {
        // Strip completion + related retire_all_active_spots RPC and per-drop
        // update_spot_stats commands tied to the stale drop(s). Also strip the
        // matching payout transaction so nothing about this ticket ships this
        // pulse.
        const staleOwners = new Set<string>();
        for (const c of commands) {
          if (c.op === 'update' && c.table === 'drops' && stale.has((c.where as { id?: string } | undefined)?.id ?? '')) {
            const src = drops.find(d => d.drop_id === (c.where as { id?: string }).id);
            if (src) staleOwners.add(src.owner_id);
          }
        }
        for (let i = commands.length - 1; i >= 0; i--) {
          const c = commands[i];
          const dropIdInWhere = (c.where as { id?: string } | undefined)?.id;
          const dropIdInData = (c.data as { drop_id?: string } | undefined)?.drop_id;
          const rpcOwner = (c.args as { _user_id?: string } | undefined)?._user_id;
          const isStaleDropCmd = (dropIdInWhere && stale.has(dropIdInWhere)) || (dropIdInData && stale.has(dropIdInData));
          const isStaleOwnerRetire = c.op === 'rpc' && c.function === 'retire_all_active_spots' && rpcOwner && staleOwners.has(rpcOwner);
          if (isStaleDropCmd || isStaleOwnerRetire) commands.splice(i, 1);
        }
      }
    }
  } catch (e) {
    console.warn('Pre-commit target verification failed (proceeding):', (e as Error).message);
  }

  // Step 3: COMMIT all commands atomically
  if (commands.length > 0) {

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delayMs = calculateBackoff(attempt - 1);
          console.log(`🔄 Retry attempt ${attempt}/${RETRY_CONFIG.maxRetries} after ${delayMs}ms delay...`);
          await sleep(delayMs);
        }
        
        const { data: result, error: execError } = await supabase
          .rpc('execute_write_batch', { _commands: commands });
        
        if (execError) {
          lastError = new Error(execError.message);
          
          if (isRetryableError(execError.message) && attempt < RETRY_CONFIG.maxRetries) {
            console.warn(`⚠️ Retryable error on attempt ${attempt + 1}: ${execError.message}`);
            continue;
          }
          
          console.error('❌ Failed to execute batch:', execError);
          throw new Error(`Failed to execute after ${attempt + 1} attempts: ${execError.message}`);
        }
        
        console.log(`✅ Batch executed successfully on attempt ${attempt + 1}:`, result);
        break;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (isRetryableError(lastError) && attempt < RETRY_CONFIG.maxRetries) {
          console.warn(`⚠️ Caught retryable error on attempt ${attempt + 1}: ${lastError.message}`);
          continue;
        }
        
        // Audit: terminal batch failure
        auditRecords.push({
          origin_drop_id: originDropId,
          event_type: 'error',
          error_message: `batch_execute_failed: ${lastError.message}`,
        });
        await flushAuditRecords(auditRecords);
        throw lastError;
      }
    }
  } else {
    console.log('📭 No commands to execute, skipping batch');
  }

  // Audit: distribution_completed + flush all collected audit rows
  auditRecords.push({
    origin_drop_id: originDropId,
    event_type: 'distribution_completed',
    amount: distributed,
    metadata: {
      payouts_made: payoutsMade,
      reentries_made: reentriesMade,
      recycled_count: recycledCount,
      total_recycled: totalRecycled,
      auto_compounds_triggered: autoCompoundsTriggered,
      spots_bought: spotsBought,
      depth,
      remaining,
    },
  });
  await flushAuditRecords(auditRecords);

  // Pending consumption now happens atomically inside the batch via consume_pending_for_cycle.

  
  return {
    success: true,
    distributed,
    payouts_made: payoutsMade,
    reentries_made: reentriesMade,
    recycled_count: recycledCount,
    total_recycled: totalRecycled,
    remaining,
    depth,
    auto_compounds_triggered: autoCompoundsTriggered,
    spots_bought: spotsBought,
  };
}

// ==========================================
// HTTP HANDLER
// ==========================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  if (!isServiceRoleCall(req)) {
    console.warn('Blocked unauthorized distribute-liquidity request');
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  const startTime = Date.now();
  let idempotencyKey = '';

  try {
    console.log('⚡ distribute-liquidity Edge Function called');
    
    cleanupIdempotencyCache();
    
    const body = await req.json().catch(() => ({}));
    const originDropId = body.origin_drop_id;
    const amount = Number(body.amount);
    const maxDepth = body.max_depth === undefined ? 100 : Number(body.max_depth);
    const force = body.force === true;

    if (!isUuid(originDropId)) {
      return jsonResponse({ success: false, error: 'A valid origin_drop_id is required' }, 400);
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonResponse({ success: false, error: 'amount must be a positive number' }, 400);
    }

    if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 100) {
      return jsonResponse({ success: false, error: 'max_depth must be between 1 and 100' }, 400);
    }
    
    idempotencyKey = getIdempotencyKey(originDropId, amount);
    
    if (!force && processedDistributions.has(idempotencyKey)) {
      const cached = processedDistributions.get(idempotencyKey)!;
      console.log(`🔁 Idempotency hit: returning cached result`);
      
      return new Response(
        JSON.stringify({ ...cached.result, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const result = await distributeLiquidity(originDropId, amount, maxDepth);
    
    processedDistributions.set(idempotencyKey, { timestamp: Date.now(), result });
    
    const durationMs = Date.now() - startTime;
    console.log(`✅ Distribution complete in ${durationMs}ms: ${result.payouts_made} payouts, ₦${result.distributed} distributed`);

    // Single broadcast at the end of the whole distribution — no per-row trigger noise.
    try {
      const { broadcastQueueChanged } = await import('../_shared/broadcastQueueChanged.ts');
      broadcastQueueChanged('distribution_complete').catch(() => {});
    } catch (_) {}

    return new Response(
      JSON.stringify({ ...result, duration_ms: durationMs }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const durationMs = Date.now() - startTime;
    
    console.error('💥 Error in distribute-liquidity:', errorMessage);
    
    const isRetryable = isRetryableError(errorMessage);
    
    return jsonResponse(
      { success: false, error: errorMessage, retryable: isRetryable, duration_ms: durationMs },
      isRetryable ? 503 : 500
    );
  }
});
