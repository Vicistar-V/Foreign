import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get JWT token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[update-economy] No authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      console.error('[update-economy] Authentication error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      console.error('[update-economy] User is not admin:', user.id);
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const {
      membershipFee,
      referralCashBonus,
      extensionSpotPrice,
      dropQueueContribution,
      payoutPerSpot,
      minimumWithdrawal,
      withdrawalFee,
      emailsEnabled,
      manualWithdrawalMode,
      taskNairaPerBatch,
      taskBatchesPerDay,
      taskTapsPerBatch,
      referralPendingBonus,
      adminPin
    } = body;

    console.log('[update-economy] Received update request from admin:', user.id);

    // Validate PIN
    if (!adminPin || typeof adminPin !== 'string' || !/^\d{4}$/.test(adminPin)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid 4-digit PIN is required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify PIN through the single bcrypt-backed verifier.
    const { data: pinResponse, error: pinError } = await supabase.functions.invoke('verify-pin', {
      body: { pin: adminPin },
      headers: { Authorization: authHeader },
    });

    if (pinError || !pinResponse?.valid) {
      console.log('[update-economy] Invalid PIN for user:', user.id, pinError || pinResponse?.error);
      return new Response(
        JSON.stringify({ success: false, error: pinResponse?.error || 'Incorrect PIN' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[update-economy] PIN verified, updating settings...');

    // Build update object (only include fields that are provided).
    // NOTE: cycle-royalty referral bonus (`drop_referral_per_cycle`) is
    // intentionally NOT exposed here — the Retirement Economy V1 uses a
    // one-time ₦1,000 activation bonus only and cycle royalties must
    // remain permanently disabled.
    const updateData: Record<string, unknown> = {};

    // ===== Retirement Economy split integrity check =====
    // Membership fee MUST cover: first-spot credit (extensionSpotPrice) + optional referrer bonus.
    // Extension price MUST cover: queue contribution + platform margin (>=0).
    // Reject any admin update that would break these invariants.
    const nextMembership = typeof membershipFee === 'number' ? membershipFee : undefined;
    const nextExtension = typeof extensionSpotPrice === 'number' ? extensionSpotPrice : undefined;
    const nextQueue = typeof dropQueueContribution === 'number' ? dropQueueContribution : undefined;
    const nextReferral = typeof referralCashBonus === 'number' ? referralCashBonus : undefined;
    const nextPayout = typeof payoutPerSpot === 'number' ? payoutPerSpot : undefined;
    const nextPendingBonus = typeof referralPendingBonus === 'number' ? referralPendingBonus : undefined;

    if (
      nextMembership !== undefined ||
      nextExtension !== undefined ||
      nextQueue !== undefined ||
      nextReferral !== undefined ||
      nextPayout !== undefined ||
      nextPendingBonus !== undefined
    ) {
      const { data: currentCfg } = await supabase
        .from('platform_config')
        .select('membership_fee, drop_entry_fee, drop_queue_contribution, referral_cash_bonus, drop_target_amount, referral_pending_bonus')
        .eq('id', 1)
        .single();

      const m = nextMembership ?? Number(currentCfg?.membership_fee ?? 5000);
      const e = nextExtension ?? Number(currentCfg?.drop_entry_fee ?? 5000);
      const q = nextQueue ?? Number(currentCfg?.drop_queue_contribution ?? 2000);
      const r = nextReferral ?? Number(currentCfg?.referral_cash_bonus ?? 1000);
      const t = nextPayout ?? Number(currentCfg?.drop_target_amount ?? 10000);
      const pb = nextPendingBonus ?? Number(currentCfg?.referral_pending_bonus ?? 3000);

      // FLAT PRICING: every share (first or extra) costs the same. What each
      // paid share must cover is the campaign contribution + the invite bonus
      // we pay the sponsor for that share. Anything left is platform margin.
      if (m < q + r) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `First share price (₦${m}) must cover the campaign contribution (₦${q}) + invite bonus (₦${r}).`,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (e < q + r) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Extra share price (₦${e}) must cover the campaign contribution (₦${q}) + invite bonus (₦${r}).`,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // P1-4 fix: pending-jump bonus must not exceed one spot's basket target,
      // otherwise a single referral could singlehandedly complete a spot cycle.
      if (pb > t) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Referral pending bonus (₦${pb}) cannot exceed payout per spot (₦${t}).`,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }



    if (typeof membershipFee === 'number') updateData.membership_fee = membershipFee;
    if (typeof referralCashBonus === 'number') updateData.referral_cash_bonus = referralCashBonus;
    if (typeof extensionSpotPrice === 'number') updateData.drop_entry_fee = extensionSpotPrice;
    if (typeof dropQueueContribution === 'number') updateData.drop_queue_contribution = dropQueueContribution;
    if (typeof payoutPerSpot === 'number') {
      updateData.drop_target_amount = payoutPerSpot;
      updateData.drop_profit_amount = payoutPerSpot;
      updateData.drop_profit_amount_subsequent = payoutPerSpot;
    }
    if (typeof minimumWithdrawal === 'number') updateData.minimum_withdrawal = minimumWithdrawal;
    if (typeof withdrawalFee === 'number') updateData.withdrawal_fee = withdrawalFee;
    if (typeof emailsEnabled === 'boolean') updateData.emails_enabled = emailsEnabled;
    if (typeof manualWithdrawalMode === 'boolean') updateData.manual_withdrawal_mode = manualWithdrawalMode;
    // F12: rate must be strictly > 0 or tasks silently earn nothing while inflating the tx table.
    if (typeof taskNairaPerBatch === 'number') {
      if (taskNairaPerBatch <= 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Money per batch must be greater than 0. Disable tasks with the enabled toggle instead of setting the rate to zero.`,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      updateData.task_naira_per_batch = taskNairaPerBatch;
    }
    // taskBatchesPerDay: 0 is the sentinel for "unlimited grind mode"
    if (typeof taskBatchesPerDay === 'number' && Number.isInteger(taskBatchesPerDay) && taskBatchesPerDay >= 0) updateData.task_batches_per_day = taskBatchesPerDay;
    if (typeof taskTapsPerBatch === 'number' && Number.isInteger(taskTapsPerBatch) && taskTapsPerBatch >= 1) updateData.task_taps_per_batch = taskTapsPerBatch;
    if (typeof referralPendingBonus === 'number' && referralPendingBonus >= 0) updateData.referral_pending_bonus = referralPendingBonus;
    
    // Always update the updated_at timestamp
    updateData.updated_at = new Date().toISOString();

    console.log('[update-economy] Updating with data:', updateData);

    // Update platform config
    const { error: updateError } = await supabase
      .from('platform_config')
      .update(updateData)
      .eq('id', 1);

    if (updateError) {
      console.error('[update-economy] Error updating config:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update settings' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[update-economy] Settings updated successfully');

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[update-economy] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An unexpected error occurred' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});