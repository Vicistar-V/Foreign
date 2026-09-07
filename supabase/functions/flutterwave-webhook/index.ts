import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, verif-hash',
};

// (System treasury removed — membership tracked under the user themselves with amount = 0.)

function verifyWebhookSignature(payload: string, signature: string): boolean {
  const secret = Deno.env.get('FLUTTERWAVE_WEBHOOK_SECRET');
  
  console.log('🔐 SIGNATURE VERIFICATION');
  console.log('📥 Received signature:', signature?.substring(0, 20) + '...');
  console.log('🔑 Secret configured:', !!secret);
  
  if (!secret) {
    console.error('❌ FLUTTERWAVE_WEBHOOK_SECRET not found in environment!');
    return false;
  }
  
  // Compute HMAC-SHA256 signature
  const computedHash = createHmac('sha256', secret).update(payload).digest('hex');
  
  // PRIMARY CHECK: Proper HMAC verification (secure)
  if (computedHash === signature) {
    console.log('✅ HMAC verification passed');
    return true;
  }
  
  console.log('⚠️ HMAC verification failed, trying fallback...');
  
  // FALLBACK CHECK: Direct secret match (for misconfigured webhooks)
  if (signature === secret) {
    console.warn('⚠️ Fallback verification passed (webhook misconfiguration detected)');
    return true;
  }
  
  console.error('❌ Both HMAC and fallback verification failed');
  return false;
}

// ============================================
// PAYMENT EVENT HANDLERS (charge.*)
// ============================================

async function handlePaymentSuccess(data: any, webhookLogId: string): Promise<Response> {
  const { data: paymentData } = data;
  const {
    tx_ref: transactionRef,
    customer: { email },
    amount: chargedAmount,
    status,
    meta
  } = paymentData;

  // Extract the original amount from metadata (what user should receive)
  const processingFee = meta?.processing_fee || 10;
  const expectedAmount = meta?.expected_amount;
  const amount = expectedAmount ? Number(expectedAmount) : (chargedAmount - processingFee);
  
  console.log('💳 Charged amount:', chargedAmount);
  console.log('💰 Credit amount:', amount);
  console.log('💸 Processing fee absorbed:', processingFee);

  if (status !== 'successful') {
    console.log('❌ Payment not successful:', status);
    return new Response('OK', { status: 200 });
  }

  console.log('💳 Processing payment:', { transactionRef, email, amount, chargedAmount });

  // Check for duplicate transaction (callback may have already processed)
  const { data: existingTx } = await supabase
    .from('transactions')
    .select('id')
    .eq('payment_reference', transactionRef)
    .maybeSingle();

  if (existingTx) {
    console.log('✅ Transaction already processed by callback:', transactionRef);
    console.log('🔄 Webhook acting as backup - no action needed');
    return new Response('OK', { status: 200 });
  }

  console.log('🔄 Processing via webhook (callback missed this):', transactionRef);

  // Find user by email
  const { data: authUser, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) throw authError;

  const user = authUser.users.find(u => u.email === email);
  
  if (!user) {
    console.error('❌ User not found for email:', email);
    await supabase.from('webhook_logs').update({
      error_message: `User not found: ${email}`
    }).eq('id', webhookLogId);
    return new Response('User not found', { status: 404 });
  }

  // Get platform config
  const { data: config } = await supabase
    .from('platform_config')
    .select('membership_fee, drop_entry_fee')
    .eq('id', 1)
    .single();

  const loopAmount = Number(config?.drop_entry_fee || 5000);

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_member')
    .eq('id', user.id)
    .single();

  // Route payment: membership vs deposit
  let transactionData: any;
  let isMembershipActivation = false;
  
  const _mfee = Number(config.membership_fee);
  const _requestedExtras = Math.max(0, Math.min(Number(meta?.auto_buy_spots) || 0, 100));
  const _isBulkActivationAmount = amount >= _mfee && amount === _mfee + _requestedExtras * loopAmount;
  const _isMembershipByMeta = String(meta?.purpose || '') === 'membership';
  if ((amount === _mfee || _isBulkActivationAmount || _isMembershipByMeta) && !profile.is_member) {
    // MEMBERSHIP PAYMENT: tracked under the user themselves (amount 0 — no treasury wallet)
    console.log('💰 Processing membership payment (tracked on user, amount 0)');
    isMembershipActivation = true;
    
    transactionData = {
      user_id: user.id,
      wallet_type: 'earnings',
      amount: 0,
      transaction_type: 'membership_fee',
      description: 'Membership activation',
      payment_reference: transactionRef,
      status: 'completed',
      metadata: {
        payment_purpose: 'membership',
        processed_via: 'webhook',
        charged_amount: chargedAmount,
        processing_fee: processingFee,
        paid_amount: amount,
      }
    };
  } else {
    // REGULAR DEPOSIT: Goes to user's deposit wallet
    console.log('💵 Processing regular deposit');
    console.log('💰 Crediting:', amount, '(they paid:', chargedAmount, ')');
    
    transactionData = {
      user_id: user.id,
      wallet_type: 'deposit',
      amount: amount, // Credit original amount, not charged amount
      transaction_type: 'deposit',
      description: 'Wallet deposit',
      payment_reference: transactionRef,
      status: 'completed',
      metadata: {
        payment_purpose: 'deposit',
        processed_via: 'webhook',
        charged_amount: chargedAmount,
        processing_fee: processingFee
      }
    };
  }
  
  // Insert transaction (membership_fee type will trigger referral commission)
  const { error: insertError } = await supabase.from('transactions').insert(transactionData);

  if (insertError) {
    // Check if it's a duplicate constraint violation (23505 = unique_violation)
    if (insertError.code === '23505' || insertError.message?.includes('duplicate key')) {
      console.log('✅ Duplicate transaction detected by database constraint');
      console.log('📋 Reference:', transactionRef);
      console.log('💡 This is expected behavior - webhook arrived after callback processed it');
      
      // Update webhook log as successful (it's not really an error)
      if (webhookLogId) {
        await supabase
          .from('webhook_logs')
          .update({ 
            processed_successfully: true,
            error_message: 'Duplicate (already processed by callback)' 
          })
          .eq('id', webhookLogId);
      }
      
      return new Response('OK', { status: 200, headers: corsHeaders });
    }
    
    // Real error - throw it
    throw insertError;
  }

  // ===== AUTO-BUY SPOTS (deposit only) =====
  if (!isMembershipActivation) {
    try {
      const requestedSpots = Number(meta?.auto_buy_spots) || 0;
      if (requestedSpots > 0) {
        const { runAutoBuySpots } = await import('../_shared/autoBuySpots.ts');
        await runAutoBuySpots(supabase, {
          userId: user.id,
          paymentRef: transactionRef,
          count: requestedSpots,
        });
      }
    } catch (autoBuyErr) {
      console.error('⚠️ auto-buy spots failed (non-critical):', autoBuyErr);
    }
  }


  // ===== MEMBERSHIP ACTIVATION: Set is_member, create spot, pending bonus =====
  if (isMembershipActivation) {
    try {
      console.log('👤 Setting is_member = true for user:', user.id);
      const { error: memberError } = await supabase
        .from('profiles')
        .update({ 
          is_member: true,
        })
        .eq('id', user.id);
      
      if (memberError) {
        console.error('❌ Failed to set is_member:', memberError);
      } else {
        console.log('✅ is_member set to true');

        // Only the first spot money enters the user's wallet.
        // The rest was paid to the business and is not recorded in any wallet.
        console.log(`💰 Activation payment (webhook): ₦${loopAmount} for first spot only`);

        // Credit ONLY the first spot amount — STRICT IDEMPOTENCY via deterministic payment_reference.
        // If callback/verify-payment already inserted this credit, the unique index on
        // transactions.payment_reference will reject this insert (23505) and we skip buy-spot.
        const activationCreditRef = `${transactionRef}::activation_credit`;
        const { error: creditError } = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            wallet_type: 'deposit',
            amount: loopAmount,
            transaction_type: 'membership_bonus',
            description: 'Activation payment for your first ad share',
            status: 'completed',
            payment_reference: activationCreditRef,
            metadata: {
              purpose: 'spot_creation_credit',
              original_payment_ref: transactionRef,
              processed_via: 'webhook',
              activation_paid: amount,
              loop_amount: loopAmount,
            }
          });

        if (creditError) {
          if (creditError.code === '23505' || creditError.message?.includes('duplicate key')) {
            console.log('✅ Activation payment already inserted by another path — skipping buy-spot to avoid double spot.');
          } else {
            console.error('⚠️ Failed to credit deposit for spot via webhook:', creditError);
          }
        } else {
          // Call buy-spot Edge Function
          const buySpotUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/buy-spot`;
          const buySpotResponse = await fetch(buySpotUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              target_user_id: user.id,
              source_wallet: 'deposit',
              skip_membership_check: true
            })
          });
          
          if (!buySpotResponse.ok) {
            const errorText = await buySpotResponse.text();
            console.error('⚠️ buy-spot Edge Function failed from webhook:', errorText);
          } else {
            console.log('✅ First spot created via buy-spot from webhook');
          }
        }

        // Create pending referral bonus if user was referred
        if (profile?.referred_by_code && profile.referred_by_code !== 'SYSTEM' && profile.referred_by_code !== '') {
          const { error: bonusError } = await supabase.rpc('pay_referrer_activation_bonus', {
            _referee_id: user.id,
            _referred_by_code: profile.referred_by_code
          });
          
          if (bonusError) {
            console.error('⚠️ Failed to pay referral bonus via webhook:', bonusError);
          } else {
            console.log('✅ Referral activation bonus paid instantly to referrer via webhook');
          }
        }
      }
    } catch (membershipError) {
      console.error('❌ Membership activation via webhook failed:', membershipError);
    }

    // ===== BULK ACTIVATION EXTRAS: credit extras to deposit + auto-buy =====
    if (_requestedExtras > 0) {
      try {
        const extrasRef = `${transactionRef}::activation_extras_credit`;
        const extrasAmt = loopAmount * _requestedExtras;
        const { error: extrasErr } = await supabase.from('transactions').insert({
          user_id: user.id,
          wallet_type: 'deposit',
          amount: extrasAmt,
          transaction_type: 'membership_bonus',
          description: `Activation top-up for ${_requestedExtras} extra ad share${_requestedExtras === 1 ? '' : 's'}`,
          status: 'completed',
          payment_reference: extrasRef,
          metadata: { purpose: 'spot_creation_credit', original_payment_ref: transactionRef, processed_via: 'webhook', extras_count: _requestedExtras },
        });
        if (!extrasErr || (extrasErr as any).code === '23505') {
          const { runAutoBuySpots } = await import('../_shared/autoBuySpots.ts');
          await runAutoBuySpots(supabase, { userId: user.id, paymentRef: `${transactionRef}::extras`, count: _requestedExtras });
        }
      } catch (e) {
        console.error('⚠️ activation extras auto-buy (webhook) failed:', e);
      }
    }
  }

  // Send Telegram alert for membership activation (non-blocking)
  if (isMembershipActivation) {
    try {
      console.log('📱 Sending Telegram activation alert (via webhook)...');
      
      // Get user's full profile for the alert
      const { data: fullProfile } = await supabase
        .from('profiles')
        .select('full_name, phone_number, referred_by_code')
        .eq('id', user.id)
        .single();
      
      // Get referrer info if exists
      let referrerName = null;
      let referrerBonus = Number(config?.referral_cash_bonus ?? 1000);
      
      if (fullProfile?.referred_by_code && fullProfile.referred_by_code !== 'SYSTEM') {
        const { data: referrer } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('referral_code', fullProfile.referred_by_code)
          .single();
        referrerName = referrer?.full_name;
      }
      
      // Call Telegram alert function
      await supabase.functions.invoke('send-telegram-alert', {
        body: {
          alertType: 'activation',
          userName: fullProfile?.full_name || 'Unknown',
          userPhone: fullProfile?.phone_number,
          userEmail: email,
          referrerCode: fullProfile?.referred_by_code,
          referrerName: referrerName,
          amount: amount,
          referrerBonus: referrerBonus,
          userId: user.id,
        }
      });
      
      console.log('✅ Telegram activation alert sent (via webhook)');

      // (Daily Task referral bonus is granted in DB by grant_referral_bonus_batches
      //  when the referee completes their first batch — no action needed here.)

    } catch (telegramError) {
      // Don't fail the main flow - just log the error
      console.error('⚠️ Telegram alert failed (non-critical):', telegramError);
    }
  }

  console.log('✅ Payment processed successfully');
  return new Response('OK', { status: 200 });
}

// ============================================
// CHARGEBACK EVENT HANDLER (charge.refunded)
// ============================================

async function handleChargeback(data: any, webhookLogId: string): Promise<Response> {
  const { data: chargeData } = data;
  const { tx_ref: transactionRef, customer: { email }, amount } = chargeData;

  console.log('🚨 CHARGEBACK DETECTED:', { transactionRef, email, amount });

  // Find original membership_fee transaction
  const { data: originalTx } = await supabase
    .from('transactions')
    .select('*, metadata')
    .eq('payment_reference', transactionRef)
    .eq('transaction_type', 'membership_fee')
    .single();

  if (!originalTx) {
    console.log('⚠️ Original transaction not found or not a membership fee:', transactionRef);
    return new Response('OK', { status: 200 });
  }

  const originalUserId = originalTx.metadata?.original_user_id;
  
  if (!originalUserId) {
    console.error('❌ Missing original_user_id in transaction metadata');
    return new Response('OK', { status: 200 });
  }

  console.log('🎯 Processing chargeback for user:', originalUserId);

  // 1. BAN USER B (the one who initiated chargeback)
  await supabase
    .from('profiles')
    .update({
      is_banned: true,
      banned_reason: `Chargeback on membership fee (${transactionRef})`,
      banned_at: new Date().toISOString()
    })
    .eq('id', originalUserId);

  console.log('🔒 User banned:', originalUserId);

  // 2. Find the referrer (User A)
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('referred_by_code')
    .eq('id', originalUserId)
    .single();

  if (!userProfile?.referred_by_code || userProfile.referred_by_code === 'SYSTEM') {
    console.log('ℹ️ No referrer found - no commission to reverse');
    return new Response('OK', { status: 200 });
  }

  // Find referrer's user_id
  const { data: referrer } = await supabase
    .from('profiles')
    .select('id')
    .eq('referral_code', userProfile.referred_by_code)
    .single();

  if (!referrer) {
    console.log('⚠️ Referrer not found for code:', userProfile.referred_by_code);
    return new Response('OK', { status: 200 });
  }

  console.log('👤 Found referrer:', referrer.id);

  // 3. Get platform config for commission amounts
  const { data: config } = await supabase
    .from('platform_config')
    .select('referral_cash_bonus')
    .eq('id', 1)
    .single();

  // 4. ATOMIC: Reverse cash commission (credits system removed)
  console.log('🔄 Processing atomic chargeback reversal');
  
  const { data: reversalResult, error: reversalError } = await supabase.rpc('atomic_chargeback_reversal', {
    _referrer_id: referrer.id,
    _banned_user_id: originalUserId,
    _reference: transactionRef,
    _cash_amount: config.referral_cash_bonus,
    _credit_amount: 0,
  });

  if (reversalError || !reversalResult?.success) {
    console.error('❌ Atomic chargeback reversal failed:', reversalError);
    throw new Error(`Chargeback reversal failed: ${reversalError?.message}`);
  }

  console.log(`💸 Atomic reversal complete: -₦${reversalResult.total_reversed}`);

  // 6. Queue chargeback alert to referrer
  await supabase.from('notifications').insert({
    user_id: referrer.id,
    notification_type: 'chargeback_alert',
    title: 'Referral Commission Reversed',
    message: `A person you invited disputed their payment. ₦${config.referral_cash_bonus.toLocaleString()} was reversed.`,
    metadata: {
      amount: config.referral_cash_bonus,
      reference: transactionRef,
      banned_user_name: userProfile.referred_by_code
    },
    link: '/wallets'
  });

  console.log('📧 Chargeback alert queued for referrer');

  // 7. Queue account banned notification to banned user
  await supabase.from('notifications').insert({
    user_id: originalUserId,
    notification_type: 'account_banned',
    title: 'Account Suspended',
    message: 'Your account has been suspended due to a payment dispute.',
    metadata: {
      reason: 'You disputed a payment with your bank. This violates our terms of service.',
      reference: transactionRef
    }
  });

  console.log('📧 Account banned notification queued for banned user');
  
  // 8. Send critical alert to admin (includes Telegram via sendCriticalAlert)
  try {
    const { sendCriticalAlert } = await import('../_shared/sendCriticalAlert.ts');
    
    await sendCriticalAlert(supabase, 'chargeback_detected', {
      banned_user_id: originalUserId,
      referrer_id: referrer.id,
      reference: transactionRef,
      amount_reversed: config.referral_cash_bonus,
      timestamp: new Date().toISOString()
    });
    
    console.log('🚨 Critical alert sent to admin (includes Telegram)');
  } catch (alertError) {
    console.error('❌ Failed to send admin alert (non-critical):', alertError);
    // Don't throw - chargeback processing succeeded, alerting is secondary
  }
  
  console.log('✅ Chargeback fully processed');
  
  return new Response('OK', { status: 200 });
}

// ============================================
// TRANSFER EVENT HANDLERS (transfer.*)
// ============================================

async function handleTransferSuccess(data: any, webhookLogId: string): Promise<Response> {
  const { data: transferData } = data;
  const { reference, status, id: transferId } = transferData;

  console.log('✅ Transfer completed successfully:', reference);

  // Find original transaction
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('payment_reference', reference)
    .single();

  if (txError || !transaction) {
    console.error('❌ Transaction not found:', reference);
    await supabase.from('webhook_logs').update({
      error_message: `Transaction not found: ${reference}`
    }).eq('id', webhookLogId);
    return new Response('Transaction not found', { status: 404 });
  }

  // Check if already completed (idempotency)
  if (transaction.status === 'completed') {
    console.log('✅ Transaction already completed (webhook duplicate)');
    return new Response('OK', { status: 200 });
  }

  // Mark as completed WITH transfer ID in metadata
  await supabase.from('transactions').update({
    status: 'completed',
    metadata: {
      ...transaction.metadata,
      transfer_id: transferId,
      completed_at: new Date().toISOString(),
      completed_via: 'webhook'
    }
  }).eq('id', transaction.id);

  // Check if notification already queued (prevent duplicates)
  const { data: existingNotif } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', transaction.user_id)
    .eq('notification_type', 'withdrawal_success')
    .eq('metadata->>reference', reference)
    .maybeSingle();

  if (!existingNotif) {
    await supabase.from('notifications').insert({
      user_id: transaction.user_id,
      notification_type: 'withdrawal_success',
      title: 'Withdrawal Successful',
      message: `Your withdrawal of ₦${Math.abs(transaction.amount).toLocaleString()} has been sent to your bank.`,
      metadata: { amount: Math.abs(transaction.amount), reference },
      link: '/wallets'
    });
    console.log('📧 Notification queued');
  } else {
    console.log('✅ Notification already queued (skipping duplicate)');
  }

  console.log('✅ Withdrawal marked complete');
  return new Response('OK', { status: 200 });
}

async function handleTransferFailed(data: any, webhookLogId: string): Promise<Response> {
  const { data: transferData } = data;
  const { reference, status, complete_message } = transferData;

  console.log('❌ Transfer failed/reversed:', { reference, status });

  // Find original transaction
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('payment_reference', reference)
    .single();

  if (txError || !transaction) {
    console.error('❌ Transaction not found:', reference);
    await supabase.from('webhook_logs').update({
      error_message: `Transaction not found: ${reference}`
    }).eq('id', webhookLogId);
    return new Response('Transaction not found', { status: 404 });
  }

  // Check if already failed (idempotency check)
  if (transaction.status === 'failed') {
    console.log('✅ Transaction already marked as failed (webhook duplicate)');
    return new Response('OK', { status: 200 });
  }

  // Mark as failed WITH detailed metadata
  await supabase.from('transactions').update({
    status: 'failed',
    metadata: {
      ...transaction.metadata,
      failure_reason: complete_message || `Transfer ${status}`,
      failed_at: new Date().toISOString(),
      transfer_status: status,
      failed_via: 'webhook'
    }
  }).eq('id', transaction.id);

  console.log('💰 Transaction marked as failed');

  // Check if refund already exists (prevent double-refund)
  const { data: existingRefund } = await supabase
    .from('transactions')
    .select('id')
    .eq('metadata->>original_transaction_id', transaction.id)
    .eq('transaction_type', 'debt_reversal')
    .maybeSingle();

  if (existingRefund) {
    console.log('✅ Refund already processed (webhook duplicate)');
    return new Response('OK', { status: 200 });
  }

  // Refund the amount back to user's earnings wallet
  await supabase.from('transactions').insert({
    user_id: transaction.user_id,
    wallet_type: 'earnings',
    amount: Math.abs(transaction.amount),
    transaction_type: 'debt_reversal',
    description: `Withdrawal failed - money returned (Ref: ${reference})`,
    status: 'completed',
    metadata: {
      original_transaction_id: transaction.id,
      original_reference: reference,
      reason: complete_message || `Transfer ${status}`,
      refunded_via: 'webhook'
    }
  });

  console.log('💸 Refund created');

  // Check if notification already queued
  const { data: existingNotif } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', transaction.user_id)
    .eq('notification_type', 'withdrawal_failed')
    .eq('metadata->>reference', reference)
    .maybeSingle();

  if (!existingNotif) {
    await supabase.from('notifications').insert({
      user_id: transaction.user_id,
      notification_type: 'withdrawal_failed',
      title: 'Withdrawal Failed - Money Returned',
      message: `Your withdrawal of ₦${Math.abs(transaction.amount).toLocaleString()} failed. The money has been returned to your wallet.`,
      metadata: { 
        amount: Math.abs(transaction.amount), 
        reference,
        message: 'Withdrawal failed, money returned to your earnings wallet'
      },
      link: '/wallets'
    });
    console.log('📧 Failure notification queued');
  } else {
    console.log('✅ Notification already queued (skipping duplicate)');
  }

  // 📱 TELEGRAM ALERT: Notify admin of webhook transfer failure
  try {
    // Get user profile for name
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', transaction.user_id)
      .single();
    
    console.log('📱 Sending Telegram transfer failure alert...');
    await supabase.functions.invoke('send-telegram-alert', {
      body: {
        alertType: 'transfer_failed',
        userName: userProfile?.full_name || 'Unknown',
        userId: transaction.user_id,
        amount: Math.abs(transaction.amount),
        reference: reference,
        errorMessage: complete_message || `Transfer ${status}`
      }
    });
    console.log('✅ Telegram transfer failure alert sent');
  } catch (telegramError) {
    console.error('⚠️ Telegram alert failed (non-critical):', telegramError);
  }

  console.log('✅ Money refunded to earnings wallet');
  return new Response('OK', { status: 200 });
}

// ============================================
// MAIN UNIFIED WEBHOOK HANDLER
// ============================================

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let webhookLogId: string | null = null;
  let eventType = 'unknown';

  try {
    console.log('📨 Flutterwave unified webhook received');

    // Verify webhook signature (SECURITY!)
    const signature = req.headers.get('verif-hash');
    const rawBody = await req.text();
    
    console.log('📦 Raw body length:', rawBody.length);
    
    if (!signature) {
      console.error('❌ No verif-hash header found in request!');
      return new Response('Unauthorized', { status: 401 });
    }
    
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error('❌ Invalid webhook signature - verification failed');
      return new Response('Unauthorized', { status: 401 });
    }
    
    console.log('✅ Webhook signature verified successfully');

    const data = JSON.parse(rawBody);
    const { event } = data;
    eventType = event;

    console.log(`📬 Event type: ${event}`);

    // Create webhook log entry for audit trail
    const { data: logEntry } = await supabase
      .from('webhook_logs')
      .insert({
        event_type: event,
        event_data: data,
        signature: signature,
        processed_successfully: false
      })
      .select('id')
      .single();

    webhookLogId = logEntry?.id || null;
    console.log(`📝 Webhook log created: ${webhookLogId}`);

    let response: Response;

    // Route to appropriate handler based on event type
    switch (event) {
      // Payment events
      case 'charge.completed':
        response = await handlePaymentSuccess(data, webhookLogId!);
        break;
      
      case 'charge.failed':
        console.log('⚠️ Payment failed event received (no action needed)');
        response = new Response('OK', { status: 200 });
        break;
      
      // CHARGEBACK EVENTS (NEW!)
      case 'charge.refunded':
      case 'charge.dispute':
        console.log('🚨 Chargeback event detected');
        response = await handleChargeback(data, webhookLogId!);
        break;
      
      // Transfer events (withdrawals)
      case 'transfer.completed':
        response = await handleTransferSuccess(data, webhookLogId!);
        break;
      
      case 'transfer.failed':
      case 'transfer.reversed':
        response = await handleTransferFailed(data, webhookLogId!);
        break;
      
      // Unknown events
      default:
        console.log(`⚠️ Unhandled event type: ${event}`);
        response = new Response('OK', { status: 200, headers: corsHeaders });
    }

    // Mark webhook log as successfully processed
    if (webhookLogId) {
      await supabase
        .from('webhook_logs')
        .update({ processed_successfully: true })
        .eq('id', webhookLogId);
    }

    console.log('✅ Webhook processed successfully');
    return response;

  } catch (error: any) {
    console.error('💥 Error in unified webhook handler');
    console.error('📋 Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    console.error('📨 Failed event type:', eventType);
    
    // Update webhook log with error
    if (webhookLogId) {
      await supabase
        .from('webhook_logs')
        .update({ 
          processed_successfully: false,
          error_message: error.message 
        })
        .eq('id', webhookLogId);
    }
    
    // 🚨 CRITICAL ALERT: Only alert on critical webhook failures
    // (transfer failures, chargebacks, not simple duplicate events)
    if (eventType === 'transfer.failed' || eventType === 'transfer.reversed' || eventType === 'charge.refunded') {
      try {
        const { sendCriticalAlert } = await import('../_shared/sendCriticalAlert.ts');
        
        await sendCriticalAlert(supabase, 'system_critical_error', {
          component: 'flutterwave-webhook',
          error: error.message,
          timestamp: new Date().toISOString(),
          event_type: eventType,
          metadata: {
            webhook_log_id: webhookLogId,
            stack_trace: error.stack
          }
        });
      } catch (alertError) {
        console.error('❌ Failed to send critical alert:', alertError);
      }
    }
    
    // Return 200 to Flutterwave (prevent retry storm for our internal errors)
    console.error('⚠️ Returning 200 to prevent webhook retry storm');
    return new Response('OK', { 
      status: 200,
      headers: corsHeaders 
    });
  }
});
