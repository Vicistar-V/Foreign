import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==========================================
// GENERIC WRITE COMMAND (same as distribute-liquidity)
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

// Awaited distribution trigger with hard timeout + reconciliation marker on
// failure. The old fire-and-forget `fetch(...).catch(...)` could be killed by
// the Deno edge runtime the moment buy-spot returned its response, leaving the
// buyer's queue_contribution deducted but never actually cascaded into the
// queue. This variant awaits the call (up to `timeoutMs`) and, if it still
// fails, writes an audit row so a human/cron can re-fire the distribution.
async function triggerDistributionSafe(
  originDropId: string,
  amount: number,
  reason: 'new_ticket' | 'extension',
  userId: string,
  timeoutMs = 25_000,
): Promise<void> {
  console.log(`🔄 Triggering distribution (${reason}) ₦${amount} from drop ${originDropId}...`);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/distribute-liquidity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ origin_drop_id: originDropId, amount }),
      signal: ctl.signal,
    });
    const text = await resp.text().catch(() => '');
    if (!resp.ok) {
      throw new Error(`distribute-liquidity HTTP ${resp.status}: ${text.slice(0, 300)}`);
    }
    console.log(`✅ Distribution (${reason}) confirmed for drop ${originDropId}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Distribution (${reason}) trigger FAILED for drop ${originDropId}:`, msg);
    // Reconciliation marker — the money already left the buyer's wallet, so
    // support can re-fire distribution against this origin drop.
    try {
      await supabase.from('drop_fill_audit_log').insert({
        origin_drop_id: originDropId,
        event_type: 'distribution_trigger_failed',
        amount,
        error_message: msg.slice(0, 500),
        metadata: { reason, user_id: userId },
      });
    } catch (auditErr) {
      console.warn('Could not write reconciliation marker:', (auditErr as Error).message);
    }
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🎰 Buy Spot request received');

    // ===== STEP 0: CHECK SYSTEM STATUS (Viketa Line) =====
    const { data: systemConfig, error: configError } = await supabase
      .from('platform_config')
      .select('drop_system_active, distribution_active')
      .eq('id', 1)
      .single();

    if (configError) {
      console.error('❌ Config error:', configError);
      return new Response(
        JSON.stringify({ error: 'Could not load platform settings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if The Viketa Line is active (spot creation allowed)
    if (!systemConfig?.drop_system_active) {
      console.log('⛔ Campaigns are paused - no new ad shares allowed');
      return new Response(
        JSON.stringify({ error: 'Campaigns are currently paused. Please try again later.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store distribution status for later (whether to trigger distribution)
    const distributionActive = systemConfig?.distribution_active !== false;
    console.log(`📊 Distribution active: ${distributionActive}`);

    // ===== STEP 1: AUTHENTICATE & DETERMINE USER =====
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Not logged in' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Parse request body first to check for target_user_id
    let sourceWallet: 'deposit' | 'earnings' = 'deposit';
    let targetUserId: string | null = null;
    let isServiceRoleCall = false;
    let skipMembershipCheck = false;
    let feeOverride: number | null = null;
    let spotLabelOverride: string | null = null;
    let idempotencyKey: string | null = null;

    try {
      const body = await req.json();
      if (body.source_wallet === 'earnings' || body.source_wallet === 'deposit') {
        sourceWallet = body.source_wallet;
      }
      // target_user_id allows service role to create spots on behalf of users
      if (body.target_user_id) {
        targetUserId = body.target_user_id;
      }
      // skip_membership_check allows creating spots during membership activation
      if (body.skip_membership_check === true) {
        skipMembershipCheck = true;
      }
      // fee_override lets service-role callers charge a non-default amount
      // (e.g. ₦5,000 for the "base" spot on a Restore Capacity checkout).
      // Queue contribution stays at the config value — the delta becomes silent platform profit.
      if (typeof body.fee_override === 'number' && body.fee_override > 0) {
        feeOverride = body.fee_override;
      }
      if (typeof body.spot_label === 'string' && body.spot_label.trim()) {
        spotLabelOverride = body.spot_label.trim().slice(0, 40);
      }
      if (typeof body.idempotency_key === 'string' && body.idempotency_key.trim()) {
        idempotencyKey = body.idempotency_key.trim().slice(0, 120);
      }
    } catch {
      // Default to deposit if no body
    }

    // Check if this is a service role call (from other edge functions)
    isServiceRoleCall = token === supabaseServiceKey;
    
    let userId: string;
    
    if (isServiceRoleCall && targetUserId) {
      // Service role call with target user - use the target user
      console.log('🔑 Service role call for target user:', targetUserId);
      userId = targetUserId;
    } else {
      // Regular user call - authenticate normally
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        console.error('❌ Auth error:', authError);
        return new Response(
          JSON.stringify({ error: 'Invalid session' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      userId = user.id;
    }

    console.log('👤 User:', userId, isServiceRoleCall ? '(via service role)' : '');

    // ===== STEP 1.5: SELF-IDEMPOTENCY LOCK =====
    // If the caller passes an idempotency_key, we insert a zero-amount lock
    // transaction with a deterministic payment_reference. The unique constraint
    // on payment_reference guarantees only ONE buy-spot call for that key
    // creates a spot — a duplicate retry (network hiccup, double-tap, caller
    // loop bug) returns the ORIGINAL spot instead of minting a second one.
    const lockRef = idempotencyKey ? `buy_spot::${userId}::${idempotencyKey}` : null;
    if (lockRef) {
      const { error: lockErr } = await supabase.from('transactions').insert({
        user_id: userId,
        wallet_type: 'deposit',
        amount: 0,
        transaction_type: 'deposit',
        description: 'Buy-spot idempotency lock',
        payment_reference: lockRef,
        status: 'completed',
        metadata: { purpose: 'buy_spot_lock', idempotency_key: idempotencyKey },
      });
      if (lockErr) {
        const code = (lockErr as any).code;
        const dup = code === '23505' || lockErr.message?.includes('duplicate key');
        if (dup) {
          console.log(`♻️ buy-spot duplicate for key ${idempotencyKey} — returning prior spot`);
          // Find the spot linked to this lock via metadata trail.
          const { data: priorTx } = await supabase
            .from('transactions')
            .select('metadata')
            .eq('user_id', userId)
            .eq('transaction_type', 'drop_entry')
            .order('created_at', { ascending: false })
            .limit(20);
          const priorSpotId = priorTx
            ?.map((t: any) => {
              try {
                const m = typeof t.metadata === 'string' ? JSON.parse(t.metadata) : t.metadata;
                return m?.spot_id ?? null;
              } catch { return null; }
            })
            .find((v: any) => !!v);
          return new Response(
            JSON.stringify({
              success: true,
              duplicate: true,
              spot_id: priorSpotId ?? null,
              message: 'Ad share already created for this request',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.error('❌ Lock insert failed:', lockErr);
        return new Response(
          JSON.stringify({ error: 'Could not lock request. Please try again.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ===== STEP 2: VALIDATE USER & GET ALL NEEDED DATA =====
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_member, is_banned, full_name, phone_number')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('❌ Profile error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Skip membership check for activation flows (user just paid, being activated now)
    if (!skipMembershipCheck && !profile.is_member) {
      return new Response(
        JSON.stringify({ error: 'You need to activate your account first before getting an ad share' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (profile.is_banned) {
      return new Response(
        JSON.stringify({ error: 'Your account has been suspended' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('💰 Source wallet:', sourceWallet);

    // ===== STEP 3: GET PLATFORM CONFIG & BALANCES (FROM LEDGER!) =====
    const [configResult, depositBalanceResult, earningsBalanceResult, spotCountResult] = await Promise.all([
      supabase.from('platform_config').select('drop_entry_fee, drop_queue_contribution, drop_target_amount').single(),
      supabase.rpc('check_balance', { _user_id: userId, _wallet_type: 'deposit' }),
      supabase.rpc('check_balance', { _user_id: userId, _wallet_type: 'earnings' }),
      supabase.from('spots').select('id', { count: 'exact' }).eq('user_id', userId),
    ]);

    if (configResult.error) {
      console.error('❌ Config error:', configResult.error);
      return new Response(
        JSON.stringify({ error: 'Could not load platform settings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = configResult.data;
    const defaultFee = Number(config.drop_entry_fee);
    // P1-4 defense-in-depth: fee_override is only trusted from service-role
    // callers AND must match one of the whitelisted platform prices (the
    // membership base fee OR the standard extra-spot fee). A leaked service
    // role key can no longer mint free ₦0 spots or arbitrary discounts.
    const { data: cfgFees } = await supabase
      .from('platform_config')
      .select('membership_fee, drop_entry_fee')
      .eq('id', 1)
      .single();
    const allowedFees = new Set<number>([
      Number(cfgFees?.membership_fee ?? 5000),
      Number(cfgFees?.drop_entry_fee ?? defaultFee),
    ]);
    let trustedOverride: number | null = null;
    if (isServiceRoleCall && feeOverride && feeOverride > 0) {
      if (allowedFees.has(Number(feeOverride))) {
        trustedOverride = Number(feeOverride);
      } else {
        console.warn('⚠️ Rejected fee_override outside whitelist:', feeOverride, [...allowedFees]);
      }
    }
    const spotCost = trustedOverride ?? defaultFee;
    // Only this portion of the spot price actually enters the queue.
    // The remainder (spotCost - queueContribution) is the platform's silent profit.
    const queueContribution = Number(config.drop_queue_contribution ?? defaultFee);

    // Get current balance from ledger (check_balance RPC calculates SUM of transactions)
    const currentBalance = sourceWallet === 'deposit' 
      ? (depositBalanceResult.data || 0)
      : (earningsBalanceResult.data || 0);

    console.log(`💵 Current ${sourceWallet} balance: ₦${currentBalance}, Spot cost: ₦${spotCost}`);

    // Check if user has enough money
    if (currentBalance < spotCost) {
      const shortfall = spotCost - currentBalance;
      return new Response(
        JSON.stringify({ 
          error: `Not enough money in your ${sourceWallet} wallet. You need ₦${shortfall} more.`,
          balance: currentBalance,
          required: spotCost,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== STEP 4: PREPARE WRITE COMMANDS =====
    const spotCount = spotCountResult.count || 0;
    const spotNumber = spotCount + 1;

    // ---- EMPIRE MODE ----
    // If the user already holds an active queue ticket, this purchase does NOT
    // grab a new position at the end of the line. Instead, it extends their
    // existing ticket: target grows by +drop_target_amount (₦10k), the wallet
    // is charged, and a new spot row (is_extension=true) is created so daily
    // task earnings scale up. Position stays locked to the first spot.
    const { data: existingDrop } = await supabase
      .from('drops')
      .select('id, position, target_amount')
      .eq('user_id', userId)
      .in('status', ['waiting', 'filling'])
      .maybeSingle();

    if (existingDrop) {
      const extraTarget = Number(config.drop_target_amount);
      const newSpotId = crypto.randomUUID();
      const spotName = spotLabelOverride || `Ad Share ${spotNumber}`;
      console.log(`🏰 Extending campaign at position #${existingDrop.position} — +₦${extraTarget} target`);

      const { data: extendRes, error: extendErr } = await supabase.rpc('extend_line_ticket', {
        _user_id: userId,
        _extra_target: extraTarget,
        _new_spot_id: newSpotId,
        _spot_name: spotName,
        _wallet: sourceWallet,
        _fee: spotCost,
      });

      if (extendErr) {
        console.error('❌ Extend ticket error:', extendErr);
        return new Response(
          JSON.stringify({ error: extendErr.message || 'Could not extend your ticket' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Notify + broadcast + admin ping (best-effort, non-blocking).
      supabase.from('notifications').insert({
        user_id: userId,
        notification_type: 'spot_purchase',
        title: `${spotName} added to your campaign!`,
        message: `Your campaign now targets ₦${Number((extendRes as any)?.new_target ?? 0).toLocaleString()}. Bigger payout coming!`,
      }).then(() => {}, () => {});

      try {
        const { broadcastQueueChanged } = await import('../_shared/broadcastQueueChanged.ts');
        broadcastQueueChanged('spot_extended').catch(() => {});
      } catch (_) {}

      // ===== TRIGGER DISTRIBUTION (extension path) =====
      // AWAITED (with hard timeout) so the Deno runtime cannot kill the fetch
      // between our response and the actual distribute-liquidity handler run.
      // On failure we write a reconciliation marker so the money can be re-fired later.
      if (distributionActive) {
        await triggerDistributionSafe(existingDrop.id, queueContribution, 'extension', userId);
      } else {
        console.log('⏸️ Distribution is OFF - extension created but money not distributed');
      }



      return new Response(
        JSON.stringify({
          success: true,
          extended: true,
          spot_id: newSpotId,
          spot_name: spotName,
          position: existingDrop.position,
          new_target: (extendRes as any)?.new_target,
          message: `${spotName} added — your campaign now targets ₦${Number((extendRes as any)?.new_target ?? 0).toLocaleString()}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- NEW TICKET PATH (first spot for this user) ----
    // Safely allocate the next queue position with a database lock so two
    // simultaneous purchases can never collide on the same position.
    const { data: claimedPosition, error: positionError } = await supabase
      .rpc('claim_next_drop_position');

    if (positionError || claimedPosition == null) {
      console.error('❌ Position allocation error:', positionError);
      return new Response(
        JSON.stringify({ error: 'Could not activate your ad share. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newPosition = claimedPosition as number;

    const spotId = crypto.randomUUID();
    const dropId = crypto.randomUUID();
    const spotName = spotLabelOverride || `Ad Share ${spotNumber}`;

    console.log(`🔧 Creating ${spotName} at position #${newPosition}`);

    const commands: WriteCommand[] = [];

    // 1. Deduct spot cost from wallet
    commands.push({
      op: 'insert',
      table: 'transactions',
      data: {
        user_id: userId,
        amount: -spotCost,
        transaction_type: 'drop_entry',
        wallet_type: sourceWallet,
        description: `${spotName} activated`,
        status: 'completed',
        metadata: JSON.stringify({ spot_id: spotId, position: newPosition }),
      },
    });

    // 2. Create spot
    commands.push({
      op: 'insert',
      table: 'spots',
      data: {
        id: spotId,
        user_id: userId,
        spot_name: spotName,
        status: 'active',
        total_cycles: 0,
        total_earnings: 0,
      },
    });

    // 3. Create drop (entry in the queue)
    commands.push({
      op: 'insert',
      table: 'drops',
      data: {
        id: dropId,
        spot_id: spotId,
        user_id: userId,
        position: newPosition,
        status: 'waiting',
        fill_amount: 0,
        target_amount: config.drop_target_amount,
        source_type: 'new',
        is_settled: false,
      },
    });

    // 4. User notification
    commands.push({
      op: 'insert',
      table: 'notifications',
      data: {
        user_id: userId,
        notification_type: 'spot_purchase',
        title: `${spotName} is now active!`,
        message: `Your campaign is moving. Sit back and wait for payouts!`,
      },
    });

    // Cache is auto-refreshed by trigger on transactions insert — no manual refresh needed.

    // ===== STEP 5: EXECUTE ALL COMMANDS =====
    console.log(`📦 Executing ${commands.length} commands...`);

    const { data: execResult, error: execError } = await supabase
      .rpc('execute_write_batch', { _commands: commands });

    if (execError) {
      // ---- RACE RECOVERY ----
      // Two concurrent buy-spot calls for the same user both saw no existing
      // drop, both claimed positions and both tried to INSERT. The partial
      // unique index `drops_one_active_per_user` rejects the second one with
      // Postgres error 23505. Instead of surfacing a scary 500, re-fetch the
      // now-committed ticket and route this request through the extend path
      // so the user still gets their spot on their existing line.
      const errMsg = String(execError.message || '');
      const isUniqueViolation =
        (execError as { code?: string }).code === '23505' ||
        /drops_one_active_per_user|duplicate key|unique constraint/i.test(errMsg);

      if (isUniqueViolation) {
        console.warn('⚠️ New-ticket race detected — rerouting to extend path');
        const { data: raceDrop } = await supabase
          .from('drops')
          .select('id, position, target_amount')
          .eq('user_id', userId)
          .in('status', ['waiting', 'filling'])
          .maybeSingle();

        if (raceDrop) {
          const extraTarget = Number(config.drop_target_amount);
          const { data: extendRes, error: extendErr } = await supabase.rpc('extend_line_ticket', {
            _user_id: userId,
            _extra_target: extraTarget,
            _new_spot_id: spotId,
            _spot_name: spotName,
            _wallet: sourceWallet,
            _fee: spotCost,
          });

          if (!extendErr) {
            try {
              const { broadcastQueueChanged } = await import('../_shared/broadcastQueueChanged.ts');
              broadcastQueueChanged('spot_extended').catch(() => {});
            } catch (_) {}

            return new Response(
              JSON.stringify({
                success: true,
                extended: true,
                spot_id: spotId,
                spot_name: spotName,
                position: raceDrop.position,
                new_target: (extendRes as { new_target?: number } | null)?.new_target,
                message: `${spotName} added — your campaign now targets ₦${Number((extendRes as { new_target?: number } | null)?.new_target ?? 0).toLocaleString()}`,
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          console.error('❌ Race recovery extend failed:', extendErr);
        }
      }

      console.error('❌ Execution error:', execError);
      return new Response(
        JSON.stringify({ error: execError.message || 'Could not activate your ad share' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    console.log('✅ Spot purchased successfully:', execResult);

    // ===== STEP 6: TRIGGER DISTRIBUTION (only if distribution is active) =====
    // AWAITED (with hard timeout) so the Deno runtime cannot kill the fetch
    // between our response and the actual distribute-liquidity handler run.
    if (distributionActive) {
      await triggerDistributionSafe(dropId, queueContribution, 'new_ticket', userId);
    } else {
      console.log('⏸️ Distribution is OFF - spot created but money not distributed');
    }

    // ===== STEP 7: SEND ALERTS (async, don't wait) =====
    // Telegram alert
    try {
      console.log('📱 Sending Telegram alert...');
      supabase.functions.invoke('send-telegram-alert', {
        body: {
          alertType: 'new_spot_purchase',
          userName: profile.full_name,
          userId: userId,
          spotName: spotName,
          position: newPosition,
          sourceWallet: sourceWallet,
        }
      }).catch(err => console.warn('Telegram alert failed:', err));
    } catch (telegramError) {
      console.warn('⚠️ Telegram alert failed (non-critical):', telegramError);
    }

    // Admin notification
    try {
      console.log('🔔 Creating admin notification...');
      supabase.from('admin_notifications').insert({
        notification_type: 'new_spot_purchase',
        title: 'New Ad Share Activated!',
        message: `${profile.full_name} activated ${spotName} and started their campaign`,
        metadata: {
          user_id: userId,
          spot_id: spotId,
          position: newPosition,
          source_wallet: sourceWallet,
        },
        link: '/admin/users',
      }).then(
        () => console.log('✅ Admin notification created'),
        (err: Error) => console.warn('Admin notification failed:', err)
      );
    } catch (notifError) {
      console.warn('⚠️ Admin notification failed (non-critical):', notifError);
    }

    // ===== STEP 8: BROADCAST + RETURN SUCCESS =====
    try {
      const { broadcastQueueChanged } = await import('../_shared/broadcastQueueChanged.ts');
      broadcastQueueChanged('spot_purchased').catch(() => {});
    } catch (_) {}

    return new Response(
      JSON.stringify({
        success: true,
        spot_id: spotId,
        spot_name: spotName,
        position: newPosition,
        message: `${spotName} activated successfully! Your campaign has started.`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
    console.error('💥 Error in buy-spot:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
