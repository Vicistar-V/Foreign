// AI Support Responder
// ---------------------
// Invoked DIRECTLY (fire-and-forget) by `add-ticket-message` whenever a
// USER posts a new message on a support ticket. No DB triggers involved.
//
// On every call we pull the last 30 messages of the ticket PLUS a live
// snapshot of the user's account state (profile, wallets, ad shares, latest
// withdrawals, pending deposit, referrals, today's task, security setup)
// straight from the database — so the AI never hallucinates.
//
// Safe-by-default:
//   * No-op if OPENROUTER_API_KEY is not configured.
//   * No-op if the ticket is closed / resolved.
//   * Skips if the most recent message is NOT from a user.
//   * Skips if the user's most recent message is image-only.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
const MAX_HISTORY = 30;

const SYSTEM_PROMPT = `You are "Viketa Helper", the friendly AI support assistant for Viketa — a Nigerian app where companies pay Viketa to learn which advert picture people like better. Members activate an "ad share", pick a picture every day, and their "campaign" fills up towards 100%. When a campaign is done, that share pays out and is finished.

# How you must talk
- Plain, simple Nigerian English. Grandma-level clear. Short sentences.
- NEVER use emojis. NEVER use markdown headings (#). Use short paragraphs.
- You may use **bold** for one or two key words, and bullet points for lists.
- Be warm, calm, reassuring. Never sound robotic. Never say "as an AI".
- Address the user by first name if you know it.
- Never invent numbers, dates, or balances. Every naira figure you quote MUST come from the LIVE PLATFORM CONFIG block or the LIVE USER CONTEXT block below. If a fact is missing from those blocks, say "Let me check with our team" — never guess.
- A human admin can also reply in this same chat. If the user needs a human (refund, account dispute, wrong money), say a teammate will jump in shortly. Don't promise specific times.

# Words you MUST use exactly this way
- A **"share"** (also called an "ad share") = one paid slot a member activates. A member can hold more than one share at a time, each running its own campaign.
- A **"campaign"** = the share's progress towards being done, shown as a percentage from 0% to 100%. Never call it a "queue" or "position" — it is not about waiting behind other people.
- Never say "spot", "The Viketa Line", "the line", "queue", "queue position", "cycle", "drop", "re-entry", "retirement"/"retired", or anything about "people ahead of you" or "people behind you". The platform is NOT a queue system.
- Never say "commission", "royalty", "investment", "invest", or "guaranteed profit". Viketa is not an investment platform — members are paid for helping companies test advert pictures.
- When a campaign reaches 100%, the share **pays out and is finished**. To keep earning, the member activates another share, which starts a brand new campaign.
- Never say the word **"drop"** to a user — that's an internal config word only, never explain it as part of the story.
- For deposits NEVER say "instantly" or "credits automatically". Say "an admin confirms your transfer — usually within a few minutes, up to 10 minutes".
- All times are Nigerian time (Africa/Lagos).

# Core mechanics (ALL amounts MUST be read from LIVE PLATFORM CONFIG — never hardcode)

## Membership activation
- One-time fee = LIVE PLATFORM CONFIG.membership_fee. After paying, the user becomes a Member and gets their **first ad share** automatically, which starts their first campaign.
- Without activation the user is in **Simulation Mode** — numbers look real but they are practice. Withdraw, Invite, Transactions, Notifications, Results, and picking daily pictures are all locked until activation.

## How a share earns (Campaign model)
- Each share has a fixed payout when its campaign completes = LIVE PLATFORM CONFIG.payout_per_spot.
- The campaign fills up as the member picks a picture each day. A campaign usually reaches 100% in about 3 to 5 days, depending on how consistently the member picks.
- When a campaign hits 100%, the full payout is released into the Earnings wallet in one lump sum, and that share is finished.
- FLAT PRICING: every ad share costs the same money — the first one and every extra one (LIVE PLATFORM CONFIG.spot_cost = LIVE PLATFORM CONFIG.membership_fee). There is NO discount for extra shares. Never tell anyone extra shares are cheaper. More active shares mean more campaigns running and filling up at the same time.

## Pending balance (very important — most users get confused here)
- Pending balance is built up by **picking a picture in the daily task** inside the app — it takes about 15 minutes a day.
- Pending balance is capped at (active shares × LIVE PLATFORM CONFIG.payout_per_spot). Once full, the daily task pauses until a campaign completes and pays into Earnings, OR until the user activates another share to make more room.
- Each daily pick adds a FLAT LIVE PLATFORM CONFIG.task_naira_per_batch to pending, regardless of how many shares the user has. Extra shares do NOT multiply per-pick earnings — they only expand the pending cap.
- Without an active share, pending stays stuck — no payout can release it.

## Daily task (picking a picture)
- If LIVE PLATFORM CONFIG.task_batches_per_day = 0, the platform is in **Unlimited Grind** mode: the user can do as many picks as they want in a day until their pending basket fills up. Otherwise the daily cap is LIVE PLATFORM CONFIG.task_batches_per_day picks.
- Each pick needs LIVE PLATFORM CONFIG.task_taps_per_batch taps and adds a FLAT LIVE PLATFORM CONFIG.task_naira_per_batch to pending.
- There is NO hard "minimum or you get burned" rule. Skipping days does NOT suspend or cancel anything — the campaign just fills more slowly.
- **Referral shortcut**: every friend the user activates instantly adds LIVE PLATFORM CONFIG.referral_pending_bonus straight into the user's pending basket (capped at remaining room). This is the fastest way to fill a basket — one activated friend = a chunk of daily picking skipped.


## Deposits
- ONLY method: **bank transfer**. Tell the user to open the app's Deposit screen — it will display a unique account number and the exact amount to send (down to the kobo). NEVER quote any specific account number yourself. The currently active deposit provider is in LIVE PLATFORM CONFIG.active_payment_method (e.g. moniepoint, paystack, flutterwave).
- It is NOT automatic. An admin confirms the transfer and credits the wallet — usually within a few minutes, can take up to 10 minutes in busy periods.
- It is safe to close the page after sending; the wallet will update.

## Withdrawals
- Minimum = LIVE PLATFORM CONFIG.minimum_withdrawal. Fee = LIVE PLATFORM CONFIG.withdrawal_fee. Always quote the live numbers.
- If LIVE PLATFORM CONFIG.withdrawals_enabled is false, tell the user withdrawals are temporarily paused.
- Money usually lands in **1–2 hours**, can take **up to 24 hours** in rare cases.
- The user needs a **4-digit PIN** and a **verified bank account** first. (Check the live context — has_pin / has_verified_bank.)

## Invite bonus
- LIVE PLATFORM CONFIG.referral_activation_bonus **instant cash** the moment a friend activates membership. This is a ONE-TIME bonus per referred friend — there is NO recurring or per-payout referral payment.
- Each active referral also gives +LIVE PLATFORM CONFIG.task_referral_bonus_batches bonus daily picks.

## Locked for non-members
- Withdraw, activating a share, Invite & Earn, Transactions, Notifications, Results — all locked until activation.

# Common user-facing statuses
- Payment: Pending / Verified / Already Processed / Failed / Not Found.
- Withdrawal: Pending / Completed / Failed.
- Ticket: Open / In Progress / Waiting User / Resolved / Closed.

# Deep links — VERY IMPORTANT
When relevant, finish your reply with ONE short clickable link so the user can act in one tap. Use plain markdown link syntax with an internal path that starts with "/". The app turns it into a button. Use ONLY these paths:
- [Open Dashboard](/dashboard) — main screen with wallets and campaign progress.
- [Go to Daily Task](/task) — pick today's picture.
- [Invite Friends](/invite) — share referral link (members only).
- [View Transactions](/transactions) — full money history (members only).
- [See Live Results](/results) — live earnings feed (members only).
- [Read Notifications](/notifications) — personal alerts (members only).
- [Edit Profile](/profile) — name, bank, security.
- [Create PIN](/create-pin) — set 4-digit security PIN.
- [Change PIN](/change-pin) — update existing PIN.
- [Change Password](/change-password) — update login password.
- [Update Photo](/set-profile-picture) — upload profile picture.
- [How it works](/how-it-works) — step-by-step guide.
- [View FAQs](/faq) — common questions.
- [Watch Explainer](/watch-explainer) — short video.
Never invent paths. Never link outside the app. Maximum ONE link per reply.

# The two live data blocks
Right after this system prompt the assistant receives TWO JSON blocks:
1. **LIVE PLATFORM CONFIG** — current platform-wide settings (fees, limits, payout amounts, feature toggles, deposit account). These are the source of truth for ALL amounts and toggles.
2. **LIVE USER CONTEXT** — THIS user's current state (wallets, shares, today's task progress, latest withdrawal, pending deposit, referrals, security setup, membership status).
Always check both before answering money/account questions. Quote actual amounts from them. If a fact is missing, do NOT make up a number — say a teammate will check.

# When NOT to answer with hard facts
- If user asks why a specific transaction failed, asks for a refund, or reports being scammed → say a human teammate will check shortly.
- If user is abusive or off-topic → gently steer back to Viketa.

Keep replies short — usually 2 to 5 sentences. Format every naira amount with the ₦ symbol and thousands separators (e.g. ₦5,000). End with ONE deep-link button if it helps. No sign-off needed.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ----------------- Live user context loader -----------------
// Pulls everything the AI needs about THIS user in one parallel burst.
async function loadUserContext(supabase: any, userId: string) {
  const lagosDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });

  const [
    profileRes,
    balancesRes,
    pendingRpcRes,
    spotsRes,
    recentTxnsRes,
    recentWithdrawalsRes,
    pendingPaymentRes,
    dailyTaskRes,
    bankCountRes,
    pinCountRes,
    platformConfigRes,
  ] = await Promise.all([
    supabase.from('profiles')
      .select('full_name, phone_number, is_member, is_banned, banned_reason, referral_code, referred_by_code, is_name_locked, created_at')
      .eq('id', userId).maybeSingle(),
    supabase.from('cached_balances')
      .select('earnings_balance, deposit_balance, pending_balance')
      .eq('user_id', userId).maybeSingle(),
    supabase.rpc('get_pending_balance', { _user_id: userId }),
    supabase.from('spots').select('status, total_cycles, total_earnings').eq('user_id', userId), // 'spots' table = ad shares
    supabase.from('transactions')
      .select('transaction_type, wallet_type, amount, status, created_at, description')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
    supabase.from('transactions')
      .select('amount, status, created_at, description')
      .eq('user_id', userId).eq('wallet_type', 'earnings').eq('transaction_type', 'withdrawal')
      .order('created_at', { ascending: false }).limit(3),
    supabase.from('payment_attempts')
      .select('amount, unique_amount, status, created_at, purpose')
      .eq('user_id', userId).in('status', ['pending', 'awaiting_confirmation'])
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('daily_task')
      .select('batches_done, bonus_batches, task_date')
      .eq('user_id', userId).eq('task_date', lagosDate).maybeSingle(),
    supabase.from('withdrawal_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('is_verified', true),
    supabase.from('user_pin_secrets')
      .select('user_id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase.from('platform_config').select('*').eq('id', 1).maybeSingle(),
  ]);

  const profile = profileRes.data || null;

  // Referrals — needs referral_code from profile
  let referrals = { total_invited: 0, total_activated: 0 };
  if (profile?.referral_code) {
    const [invitedRes, activatedRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true })
        .eq('referred_by_code', profile.referral_code),
      supabase.from('profiles').select('id', { count: 'exact', head: true })
        .eq('referred_by_code', profile.referral_code).eq('is_member', true),
    ]);
    referrals = {
      total_invited: invitedRes.count || 0,
      total_activated: activatedRes.count || 0,
    };
  }

  // spotsArr rows represent this user's ad shares / campaigns
  const spotsArr = spotsRes.data || [];
  const spots = {
    total_count: spotsArr.length,
    active_count: spotsArr.filter((s: any) => s.status === 'active').length,
    total_cycles: spotsArr.reduce((a: number, s: any) => a + (Number(s.total_cycles) || 0), 0),
    total_earnings: spotsArr.reduce((a: number, s: any) => a + (Number(s.total_earnings) || 0), 0),
  };

  const cfg = platformConfigRes.data || {};

  const platform = {
    // money — Ad Share + Campaign model
    membership_fee: Number(cfg.membership_fee ?? 5000), // first ad share fee
    spot_cost: Number(cfg.drop_entry_fee ?? 5000), // cost to activate an extra ad share
    queue_contribution_per_spot: Number(cfg.drop_queue_contribution ?? 2000),
    payout_per_spot: Number(cfg.drop_target_amount ?? 10000), // what one share pays when its campaign hits 100%
    // withdrawals
    minimum_withdrawal: Number(cfg.minimum_withdrawal ?? 5000),
    withdrawal_fee: Number(cfg.withdrawal_fee ?? 50),
    withdrawals_enabled: cfg.withdrawals_enabled !== false,
    manual_withdrawal_mode: cfg.manual_withdrawal_mode === true,
    // referrals — ONE-TIME activation bonus only. Never call this a commission or royalty.
    referral_activation_bonus: Number(cfg.referral_cash_bonus ?? 1000),
    referral_payout_trigger: 'on_activation',
    // daily task
    task_enabled: cfg.task_enabled !== false,
    task_batches_per_day: Number(cfg.task_batches_per_day ?? 7),
    task_taps_per_batch: Number(cfg.task_taps_per_batch ?? 50),
    task_naira_per_batch: Number(cfg.task_naira_per_batch ?? 0),
    task_referral_bonus_batches: Number(cfg.task_referral_bonus_batches ?? 5),
    referral_pending_bonus: Number(cfg.referral_pending_bonus ?? 3000),
    unlimited_grind_mode: Number(cfg.task_batches_per_day ?? 7) === 0,
    // system toggles
    drop_system_active: cfg.drop_system_active !== false,
    distribution_active: cfg.distribution_active !== false,
    maintenance_mode: cfg.maintenance_mode === true,
    // active deposit method (just the name — NEVER expose account numbers to the AI)
    active_payment_method: cfg.payment_provider ?? 'moniepoint',
    // community
    whatsapp_group_link: cfg.whatsapp_group_link ?? null,
  };

  return {
    profile: profile && {
      full_name: profile.full_name,
      // phone_number & referral_code intentionally STRIPPED — PII not needed by AI
      is_member: profile.is_member,
      is_banned: profile.is_banned,
      banned_reason: profile.banned_reason,
      referred_by_code: profile.referred_by_code ? '(has referrer)' : null,
      is_name_locked: profile.is_name_locked,
      joined_at: profile.created_at,
    },
    balances: balancesRes.data || { earnings_balance: 0, deposit_balance: 0, pending_balance: 0 },
    pending_balance_live: Number(pendingRpcRes.data ?? 0),
    spots,
    recent_txns: (recentTxnsRes.data || []).map((t: any) => ({
      type: t.transaction_type, wallet: t.wallet_type, amount: Number(t.amount),
      status: t.status, desc: t.description, at: t.created_at,
    })),
    recent_withdrawals: (recentWithdrawalsRes.data || []).map((w: any) => ({
      amount: Math.abs(Number(w.amount)), status: w.status, desc: w.description, at: w.created_at,
    })),
    pending_payment: pendingPaymentRes.data || null,
    referrals,
    daily_task: dailyTaskRes.data
      ? {
          task_date: dailyTaskRes.data.task_date,
          batches_done: dailyTaskRes.data.batches_done,
          bonus_batches: dailyTaskRes.data.bonus_batches,
        }
      : { task_date: lagosDate, batches_done: 0, bonus_batches: 0 },
    has_verified_bank: (bankCountRes.count || 0) > 0,
    has_pin: (pinCountRes.count || 0) > 0,
    _platform: platform, // attached for backward compat
  };
}

// Helper — insert a graceful fallback reply when the AI itself cannot respond.
// Keeps the chat alive so the user never sees ghosting.
async function insertFallbackReply(
  supabase: any,
  ticket: { id: string; user_id: string; subject: string; status: string },
  reason: string,
  message: string,
) {
  await supabase.from('ticket_messages').insert({
    ticket_id: ticket.id,
    sender_id: ticket.user_id,
    sender_type: 'ai',
    message,
    metadata: { fallback: true, reason, generated_by: 'ai-support-responder' },
  });

  if (ticket.status === 'open') {
    await supabase.from('support_tickets').update({ status: 'in_progress' }).eq('id', ticket.id);
  }

  await supabase.from('notifications').insert({
    user_id: ticket.user_id,
    notification_type: 'ticket_reply',
    title: 'Support Replied',
    message: message.slice(0, 100),
    metadata: { ticket_id: ticket.id, subject: ticket.subject, from: 'ai', fallback: true },
    link: '/support',
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let ticket: any = null;

  try {
    const body = await req.json().catch(() => ({}));
    const ticketId = body?.ticket_id;
    const expectedLastMessageId: string | undefined = body?.last_message_id;
    if (!ticketId) return json({ error: 'Missing ticket_id' }, 400);

    // Load ticket
    const { data: t, error: tErr } = await supabase
      .from('support_tickets')
      .select('id, user_id, subject, category, status, metadata')
      .eq('id', ticketId)
      .maybeSingle();

    if (tErr || !t) {
      console.error('[ai-support-responder] Ticket not found', tErr);
      return json({ skipped: true, reason: 'no_ticket' });
    }
    ticket = t;

    // --- Auth gate: allow internal service-role invocations, ticket owner, or admin ---
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const isInternal = token && token === serviceKey;
    if (!isInternal) {
      if (!token) return json({ error: 'Unauthorized' }, 401);
      const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
      const claims = claimsData?.claims as { sub?: string; role?: string } | undefined;
      if (claimsErr || !claims?.sub) return json({ error: 'Unauthorized' }, 401);
      if (claims.role === 'service_role') {
        // ok — service-role JWT
      } else {
        const isOwner = claims.sub === ticket.user_id;
        let isAdmin = false;
        if (!isOwner) {
          const { data: adm } = await supabase.rpc('has_role', {
            _user_id: claims.sub,
            _role: 'admin',
          });
          isAdmin = !!adm;
        }
        if (!isOwner && !isAdmin) return json({ error: 'Forbidden' }, 403);
      }
    }


    if (ticket.status === 'closed') {
      return json({ skipped: true, reason: 'ticket_closed' });
    }

    // ----- Global kill switch: admin can turn off the AI helper -----
    const { data: aiCfg } = await supabase
      .from('platform_config')
      .select('ai_support_enabled')
      .eq('id', 1)
      .maybeSingle();
    if (aiCfg && aiCfg.ai_support_enabled === false) {
      console.log('[ai-support-responder] Disabled by admin, skipping');
      return json({ skipped: true, reason: 'ai_support_disabled' });
    }

    // ----- Spam lock: only one AI run at a time per ticket -----
    const meta = (ticket.metadata as Record<string, any>) || {};
    const lockedAt = meta.ai_generating_at ? new Date(meta.ai_generating_at).getTime() : 0;
    const lockFresh = lockedAt && (Date.now() - lockedAt) < 60_000; // 60s stale window
    if (lockFresh) {
      console.log('[ai-support-responder] Lock held, skipping');
      return json({ skipped: true, reason: 'locked' });
    }
    await supabase
      .from('support_tickets')
      .update({ metadata: { ...meta, ai_generating_at: new Date().toISOString() } })
      .eq('id', ticket.id);

    // Pull the last MAX_HISTORY messages
    const { data: msgs, error: mErr } = await supabase
      .from('ticket_messages')
      .select('id, sender_type, message, image_url, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false })
      .limit(MAX_HISTORY);

    if (mErr || !msgs || msgs.length === 0) {
      await releaseLock(supabase, ticket.id);
      return json({ skipped: true, reason: 'no_messages' });
    }

    const ordered = [...msgs].reverse();
    const last = ordered[ordered.length - 1];

    if (last.sender_type !== 'user') {
      await releaseLock(supabase, ticket.id);
      return json({ skipped: true, reason: 'latest_not_user' });
    }

    // If caller told us which message they expected to respond to and it changed,
    // abort — another message has already arrived; the next invocation will handle it.
    if (expectedLastMessageId && last.id !== expectedLastMessageId) {
      await releaseLock(supabase, ticket.id);
      return json({ skipped: true, reason: 'stale_trigger' });
    }

    const lastText = (last.message || '').trim();

    // ----- Image-only acknowledgement — no AI call needed -----
    if (!lastText && last.image_url) {
      await insertFallbackReply(
        supabase,
        ticket,
        'image_only',
        "Got your image — I can see the attachment. A teammate will take a look shortly and get back to you here.",
      );
      await releaseLock(supabase, ticket.id);
      return json({ success: true, reason: 'image_ack' });
    }

    if (!lastText) {
      await releaseLock(supabase, ticket.id);
      return json({ skipped: true, reason: 'empty_message' });
    }

    // ----- No API key — post a soft fallback so the chat never goes silent -----
    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) {
      console.warn('[ai-support-responder] OPENROUTER_API_KEY not set — posting fallback');
      await insertFallbackReply(
        supabase,
        ticket,
        'no_api_key',
        "Thanks for reaching out — a teammate will reply here shortly.",
      );
      await releaseLock(supabase, ticket.id);
      return json({ skipped: true, reason: 'no_api_key' });
    }

    // ===== Pull LIVE user context straight from DB =====
    const userContext = await loadUserContext(supabase, ticket.user_id);
    const firstName = userContext.profile?.full_name?.split(' ')[0] || '';
    const { _platform: platformConfig, ...userOnly } = userContext as any;

    const openrouterMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'system',
        content:
          `Ticket info:\n- Subject: "${ticket.subject}"\n- Category: ${ticket.category}\n- User first name: ${firstName || 'unknown'}\n\n` +
          `LIVE PLATFORM CONFIG (source of truth for ALL amounts, fees, limits, toggles — quote these, never invent):\n` +
          '```json\n' + JSON.stringify(platformConfig, null, 2) + '\n```\n\n' +
          `LIVE USER CONTEXT (this user's current state — wallets, ad shares, task, referrals, security):\n` +
          '```json\n' + JSON.stringify(userOnly, null, 2) + '\n```',
      },
      ...ordered.map((m) => {
        const role = m.sender_type === 'user' ? 'user' : 'assistant';
        const prefix = m.sender_type === 'admin' ? '[Human teammate]: ' : '';
        const text = (m.message || '').trim() || (m.image_url ? '(sent an image)' : '');
        return { role, content: `${prefix}${text}` };
      }),
    ];

    console.log(`[ai-support-responder] Streaming ${DEFAULT_MODEL} on ticket ${ticketId} (${ordered.length} ctx msgs)`);

    // ===== STREAMING =====
    // 1. Pre-insert empty AI placeholder → frontend's realtime sub shows the
    //    bubble INSTANTLY (no waiting for first token).
    // 2. Stream tokens from OpenRouter, buffer, UPDATE the row every ~250ms
    //    so realtime fans the partial text out live.
    // 3. Final UPDATE flips streaming=false.
    const { data: placeholder, error: phErr } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticketId,
        sender_id: ticket.user_id,
        sender_type: 'ai',
        message: '',
        metadata: {
          model: DEFAULT_MODEL,
          generated_by: 'ai-support-responder',
          streaming: true,
          started_at: new Date().toISOString(),
        },
      })
      .select('id')
      .single();

    if (phErr || !placeholder) {
      console.error('[ai-support-responder] Placeholder insert failed', phErr);
      await releaseLock(supabase, ticket.id);
      return json({ error: 'Failed to create reply placeholder' }, 500);
    }
    const messageId = placeholder.id;

    // 45s hard timeout for the whole stream
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 45_000);

    let aiResp: Response;
    try {
      aiResp = await fetch(OPENROUTER_URL, {
        method: 'POST',
        signal: abort.signal,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://viketa.xyz',
          'X-Title': 'Viketa Support Assistant',
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          messages: openrouterMessages,
          temperature: 0.6,
          stream: true,
          reasoning: { exclude: true },
        }),
      });
    } catch (e: any) {
      clearTimeout(timer);
      console.error('[ai-support-responder] Fetch failed/timeout', e?.message);
      await supabase.from('ticket_messages').update({
        message: "Our assistant is taking longer than usual. A teammate will jump in shortly to help.",
        metadata: { model: DEFAULT_MODEL, generated_by: 'ai-support-responder', streaming: false, fallback: true, reason: 'ai_timeout' },
      }).eq('id', messageId);
      await releaseLock(supabase, ticket.id);
      return json({ skipped: true, reason: 'ai_timeout' });
    }

    if (!aiResp.ok || !aiResp.body) {
      clearTimeout(timer);
      const errText = await aiResp.text().catch(() => '');
      console.error('[ai-support-responder] OpenRouter error', aiResp.status, errText);
      await supabase.from('ticket_messages').update({
        message: "Our assistant hit a hiccup. A teammate will reply here shortly.",
        metadata: { model: DEFAULT_MODEL, generated_by: 'ai-support-responder', streaming: false, fallback: true, reason: `ai_http_${aiResp.status}` },
      }).eq('id', messageId);
      await releaseLock(supabase, ticket.id);
      return json({ skipped: true, reason: 'ai_error', status: aiResp.status });
    }

    // ----- Stream loop with throttled DB updates -----
    let accumulated = '';
    let lastFlushedLen = 0;
    let lastFlushAt = 0;
    const FLUSH_INTERVAL_MS = 250;
    const FLUSH_MIN_CHARS = 12;

    const flush = async (force = false) => {
      const now = Date.now();
      const delta = accumulated.length - lastFlushedLen;
      if (!force && (delta < FLUSH_MIN_CHARS || now - lastFlushAt < FLUSH_INTERVAL_MS)) return;
      if (delta === 0 && !force) return;
      lastFlushedLen = accumulated.length;
      lastFlushAt = now;
      await supabase.from('ticket_messages')
        .update({ message: accumulated })
        .eq('id', messageId);
    };

    const reader = aiResp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      streamLoop: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nlIdx: number;
        while ((nlIdx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nlIdx).trim();
          buffer = buffer.slice(nlIdx + 1);
          if (!line || !line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') break streamLoop;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed?.choices?.[0]?.delta ?? {};
            const piece: string = (delta.content || '') as string;
            const reasoningPiece: string = typeof delta.reasoning === 'string' ? delta.reasoning : '';
            if (piece) accumulated += piece;
            else if (!accumulated && reasoningPiece) accumulated += reasoningPiece;
          } catch {
            // ignore malformed chunks
          }
        }
        await flush(false);
      }
    } catch (e: any) {
      console.error('[ai-support-responder] Stream read error', e?.message);
    } finally {
      clearTimeout(timer);
    }

    const finalReply = accumulated.trim();

    if (!finalReply) {
      console.warn('[ai-support-responder] Empty stream reply');
      await supabase.from('ticket_messages').update({
        message: "I couldn't put together a clear answer for that one — a teammate will reply here shortly.",
        metadata: { model: DEFAULT_MODEL, generated_by: 'ai-support-responder', streaming: false, fallback: true, reason: 'empty_reply' },
      }).eq('id', messageId);
      await releaseLock(supabase, ticket.id);
      return json({ skipped: true, reason: 'empty_reply' });
    }

    // Final flush: full text + clear streaming flag
    await supabase.from('ticket_messages')
      .update({
        message: finalReply,
        metadata: {
          model: DEFAULT_MODEL,
          generated_by: 'ai-support-responder',
          streaming: false,
          completed_at: new Date().toISOString(),
        },
      })
      .eq('id', messageId);

    if (ticket.status === 'open') {
      await supabase.from('support_tickets').update({ status: 'in_progress' }).eq('id', ticketId);
    }

    await supabase.from('notifications').insert({
      user_id: ticket.user_id,
      notification_type: 'ticket_reply',
      title: 'Support Replied',
      message: finalReply.slice(0, 100),
      metadata: { ticket_id: ticketId, subject: ticket.subject, from: 'ai' },
      link: '/support',
    });

    await releaseLock(supabase, ticket.id);
    console.log('[ai-support-responder] Reply posted for ticket', ticketId);
    return json({ success: true });
  } catch (e: any) {
    console.error('[ai-support-responder] Unexpected', e);
    if (ticket?.id) await releaseLock(supabase, ticket.id).catch(() => {});
    return json({ error: e?.message || 'server_error' }, 500);
  }
});

async function releaseLock(supabase: any, ticketId: string) {
  const { data } = await supabase
    .from('support_tickets')
    .select('metadata')
    .eq('id', ticketId)
    .maybeSingle();
  const meta = (data?.metadata as Record<string, any>) || {};
  delete meta.ai_generating_at;
  await supabase.from('support_tickets').update({ metadata: meta }).eq('id', ticketId);
}
