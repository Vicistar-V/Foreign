import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// 🧪 TEST MODE: Temporarily disable transaction processing
// Set to true to let webhook handle all processing
// Set to false to re-enable callback processing
// ============================================
const TEST_MODE_WEBHOOK_ONLY = false;

const DEFAULT_SAFE_ORIGIN = 'https://viketa.xyz';

// Accept any valid http(s) origin passed by the initiator. No allow-list.
function getSafeRedirectOrigin(candidate: string | null): string {
  if (!candidate) return DEFAULT_SAFE_ORIGIN;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin;
    }
  } catch {
    // fall through
  }
  return DEFAULT_SAFE_ORIGIN;
}

// ============================================
// 💸 WITHDRAWAL VERIFICATION FUNCTION
// ============================================
async function verifyWithdrawal(reference: string): Promise<Response> {
  console.log('🔐 Verifying withdrawal:', reference);
  
  try {
    // STEP 1: Find the original transaction in our database
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('payment_reference', reference)
      .eq('transaction_type', 'withdrawal')
      .maybeSingle();
    
    if (txError || !transaction) {
      console.error('❌ Transaction not found:', reference);
      return new Response(
        JSON.stringify({ 
          error: 'Transaction not found',
          reference 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // STEP 2: Check if already processed
    if (transaction.status === 'completed') {
      console.log('✅ Transaction already completed');
      return new Response(
        JSON.stringify({ 
          status: 'completed',
          message: 'Money successfully sent to your bank account',
          reference,
          amount: Math.abs(transaction.amount)
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    if (transaction.status === 'failed') {
      console.log('❌ Transaction already marked as failed');
      return new Response(
        JSON.stringify({ 
          status: 'failed',
          message: 'This withdrawal previously failed. Money was returned.',
          reference 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // STEP 3: Verify with Flutterwave API (ACTIVE VERIFICATION!)
    console.log('🔐 Calling Flutterwave Transfers API...');
    const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
    
    const verifyResponse = await fetch(
      `https://api.flutterwave.com/v3/transfers?reference=${reference}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${flutterwaveSecretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!verifyResponse.ok) {
      console.error('❌ Flutterwave API error:', verifyResponse.statusText);
      return new Response(
        JSON.stringify({ 
          error: 'Could not verify withdrawal status',
          details: 'Flutterwave API unavailable'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    const verificationData = await verifyResponse.json();
    console.log('✅ Verification response:', JSON.stringify(verificationData, null, 2));
    
    // STEP 4: Extract transfer data
    const transfers = verificationData.data;
    
    if (!transfers || transfers.length === 0) {
      console.warn('⚠️ No transfer found with this reference in Flutterwave');
      
      // ============================================
      // 🛡️ MANUAL WITHDRAWAL CHECK
      // If this is a manual withdrawal, DON'T auto-fail!
      // It's waiting for admin approval, not Flutterwave.
      // ============================================
      const isManualWithdrawal = transaction.metadata?.is_manual === true;
      
      if (isManualWithdrawal) {
        console.log('📋 This is a MANUAL withdrawal - awaiting admin approval');
        console.log('⏳ Will NOT auto-fail. Admin must approve/reject manually.');
        
        return new Response(
          JSON.stringify({ 
            status: 'pending',
            message: 'Waiting for admin approval. Your withdrawal is being reviewed.',
            reference,
            is_manual: true
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      // ============================================
      // ⏰ AUTOMATIC WITHDRAWAL: Check if too old
      // Only auto-fail non-manual withdrawals
      // ============================================
      const transactionAge = Date.now() - new Date(transaction.created_at).getTime();
      const thirtyMinutes = 30 * 60 * 1000;
      
      if (transactionAge > thirtyMinutes) {
        console.log('⏰ Transaction too old (>30 min) - auto-failing and refunding');
        
        // Mark as failed
        await supabase
          .from('transactions')
          .update({ 
            status: 'failed',
            metadata: {
              ...transaction.metadata,
              failure_reason: 'Transfer not found in Flutterwave after 30 minutes - likely never created',
              failed_at: new Date().toISOString(),
              auto_failed: true
            }
          })
          .eq('id', transaction.id);
        
        // Get the withdrawal fee from metadata or use default
        const withdrawalFee = transaction.metadata?.withdrawal_fee || 50;
        const totalRefund = Math.abs(transaction.amount) + withdrawalFee;
        
        // Refund user (withdrawal amount + fee in one transaction)
        await supabase.from('transactions').insert({
          user_id: transaction.user_id,
          wallet_type: 'earnings',
          amount: totalRefund,
          transaction_type: 'debt_reversal',
          description: `Withdrawal failed - full refund (Ref: ${reference})`,
          status: 'completed',
          metadata: {
            original_transaction_id: transaction.id,
            refund_reason: 'transfer_not_found_after_30min',
            withdrawal_amount: Math.abs(transaction.amount),
            fee_refunded: withdrawalFee
          }
        });
        
        // Queue notification
        await supabase.from('notifications').insert({
          user_id: transaction.user_id,
          notification_type: 'withdrawal_failed',
          title: 'Withdrawal Failed',
          message: `₦${totalRefund.toLocaleString()} has been returned to your wallet`,
          metadata: { amount: totalRefund, reference },
          link: '/wallets'
        });
        
        console.log('✅ Auto-failed old stuck transaction and refunded user');
        
        return new Response(
          JSON.stringify({ 
            status: 'failed',
            message: 'Withdrawal failed. Money has been returned to your earnings wallet.',
            reference,
            amount: Math.abs(transaction.amount)
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      // Still within 30 minutes - genuinely might be processing
      console.log('⏳ Transaction is recent (<30 min) - might still be processing');
      return new Response(
        JSON.stringify({ 
          status: 'pending',
          message: 'Withdrawal is still being processed by the bank. Please check back soon.',
          reference 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    const transferData = transfers[0];
    const transferStatus = transferData.status.toUpperCase();
    
    console.log('📊 Transfer status from Flutterwave:', transferStatus);
    
    // STEP 5: Process based on status
    if (transferStatus === 'SUCCESSFUL') {
      console.log('✅ Transfer successful - updating database');
      
      // Mark transaction as completed
      await supabase
        .from('transactions')
        .update({ 
          status: 'completed',
          metadata: { 
            ...transaction.metadata,
            flutterwave_id: transferData.id,
            completed_at: new Date().toISOString()
          }
        })
        .eq('id', transaction.id);
      
      // Queue success notification
      await supabase.from('notifications').insert({
        user_id: transaction.user_id,
        notification_type: 'withdrawal_complete',
        title: 'Money Sent!',
        message: `₦${Math.abs(transaction.amount).toLocaleString()} has been sent to your bank`,
        metadata: { amount: Math.abs(transaction.amount), reference, bank_name: transferData.bank_name || 'your bank' },
        link: '/wallets'
      });
      
      return new Response(
        JSON.stringify({ 
          status: 'completed',
          message: 'Money successfully sent to your bank account',
          reference,
          amount: Math.abs(transaction.amount)
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    if (transferStatus === 'FAILED') {
      console.log('❌ Transfer failed - refunding user');
      
      // Mark original transaction as failed
      await supabase
        .from('transactions')
        .update({ 
          status: 'failed',
          metadata: { 
            ...transaction.metadata,
            flutterwave_id: transferData.id,
            failure_reason: transferData.complete_message || 'Transfer failed'
          }
        })
        .eq('id', transaction.id);
      
      // Get the withdrawal fee from metadata or use default
      const withdrawalFee = transaction.metadata?.withdrawal_fee || 50;
      const totalRefund = Math.abs(transaction.amount) + withdrawalFee;
      
      // Refund the user (withdrawal amount + fee in one transaction)
      await supabase.from('transactions').insert({
        user_id: transaction.user_id,
        wallet_type: 'earnings',
        amount: totalRefund,
        transaction_type: 'debt_reversal',
        description: `Withdrawal failed - full refund (Ref: ${reference})`,
        status: 'completed',
        metadata: {
          original_transaction_id: transaction.id,
          refund_reason: 'withdrawal_failed',
          withdrawal_amount: Math.abs(transaction.amount),
          fee_refunded: withdrawalFee
        }
      });
      
      // Queue failure notification
      await supabase.from('notifications').insert({
        user_id: transaction.user_id,
        notification_type: 'withdrawal_failed',
        title: 'Withdrawal Failed',
        message: `₦${totalRefund.toLocaleString()} has been returned to your wallet`,
        metadata: { amount: totalRefund, reference },
        link: '/wallets'
      });
      
      return new Response(
        JSON.stringify({ 
          status: 'failed',
          message: 'Withdrawal failed. Money has been returned to your earnings wallet.',
          reference,
          amount: Math.abs(transaction.amount)
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Still pending
    return new Response(
      JSON.stringify({ 
        status: 'pending',
        message: 'Withdrawal is still being processed by the bank',
        reference 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error: any) {
    console.error('💥 Error in verifyWithdrawal:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Verification error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// ============================================
// 🎯 MAIN HANDLER
// ============================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔗 Flutterwave callback received');
    console.log('📍 Request URL:', req.url);
    
    const url = new URL(req.url);
    
    // Detect verification type
    const verificationType = url.searchParams.get('type') || 'payment';
    const isWithdrawal = verificationType === 'withdrawal';
    
    console.log('🔍 Verification type:', verificationType);
    
    // Route to withdrawal verification
    if (isWithdrawal) {
      const reference = url.searchParams.get('reference');
      
      if (!reference) {
        return new Response(
          JSON.stringify({ error: 'Missing withdrawal reference' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      return await verifyWithdrawal(reference);
    }
    
    // === PAYMENT VERIFICATION (EXISTING LOGIC) ===
    const params = {
      status: url.searchParams.get('status'),
      tx_ref: url.searchParams.get('tx_ref'),
      transaction_id: url.searchParams.get('transaction_id'),
    };
    
    const origin = getSafeRedirectOrigin(url.searchParams.get('origin'));
    
    console.log('📦 Callback params:', params);
    console.log('🏠 Origin URL:', origin);

    // Check if all required params are present
    if (!params.status || !params.tx_ref || !params.transaction_id) {
      console.error('❌ Missing required parameters');
      return Response.redirect(`${origin}/dashboard?payment=failed&reason=invalid_callback`, 302);
    }

    // If payment was cancelled or failed
    if (params.status === 'cancelled' || params.status === 'failed') {
      console.log('❌ Payment was cancelled or failed:', params.status);
      return Response.redirect(`${origin}/dashboard?payment=failed&reason=${params.status}`, 302);
    }

    // Verify transaction with Flutterwave API
    console.log('🔐 Calling Flutterwave Verify API...');
    const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
    
    const verifyResponse = await fetch(
      `https://api.flutterwave.com/v3/transactions/${params.transaction_id}/verify`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${flutterwaveSecretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!verifyResponse.ok) {
      console.error('❌ Flutterwave verification failed:', verifyResponse.statusText);
      return Response.redirect(`${origin}/dashboard?payment=failed&reason=verification_failed`, 302);
    }

    const verificationData = await verifyResponse.json();
    console.log('✅ Verification response:', JSON.stringify(verificationData, null, 2));

    const { data: txData } = verificationData;

    // Validate transaction details
    if (txData.status !== 'successful') {
      console.error('❌ Transaction not successful:', txData.status);
      return Response.redirect(`${origin}/dashboard?payment=failed&reason=${txData.status}`, 302);
    }

    if (txData.tx_ref !== params.tx_ref) {
      console.error('❌ Transaction reference mismatch:', txData.tx_ref, 'vs', params.tx_ref);
      return Response.redirect(`${origin}/dashboard?payment=failed&reason=reference_mismatch`, 302);
    }

    if (txData.currency !== 'NGN') {
      console.error('❌ Invalid currency:', txData.currency);
      return Response.redirect(`${origin}/dashboard?payment=failed&reason=invalid_currency`, 302);
    }

    console.log('💳 Transaction details validated:', {
      status: txData.status,
      amount: txData.amount,
      tx_ref: txData.tx_ref,
      customer_email: txData.customer.email,
    });

    // ===== BULLETPROOF USER IDENTIFICATION (4-LAYER VERIFICATION) =====
    console.log('🔍 Starting multi-layer payment verification...');

    // LAYER 1 (PRIMARY): Extract user_id from Flutterwave metadata
    const userId = txData.meta?.user_id;
    const expectedAmount = txData.meta?.expected_amount;
    const paymentPurpose = txData.meta?.purpose || 'deposit';

    if (!userId) {
      console.error('❌ CRITICAL: Missing user_id in transaction metadata');
      console.error('   Metadata received:', JSON.stringify(txData.meta));
      console.error('   This should never happen if payment was initiated through our system');
      return Response.redirect(`${origin}/dashboard?payment=failed&reason=missing_user_data`, 302);
    }

    console.log('✅ LAYER 1 PASSED: User ID from metadata:', userId);
    console.log('💰 Transaction amount:', txData.amount);
    console.log('🎯 Payment purpose:', paymentPurpose);
    console.log('📊 Expected amount:', expectedAmount);

    // LAYER 2 (SECONDARY): Cross-verify tx_ref contains the user_id
    if (!params.tx_ref.includes(userId)) {
      console.warn('⚠️ LAYER 2 WARNING: tx_ref does not contain user_id');
      console.warn('   tx_ref:', params.tx_ref);
      console.warn('   user_id:', userId);
      console.warn('   Possible tampering attempt or reference format mismatch');
    } else {
      console.log('✅ LAYER 2 PASSED: tx_ref cross-verification successful');
    }

    // LAYER 3 (TERTIARY): Verify user exists in our database
    console.log('🔍 LAYER 3: Checking user in database...');
    const { data: userProfile, error: userError } = await supabase
      .from('profiles')
      .select('full_name, is_member, is_name_locked')
      .eq('id', userId)
      .maybeSingle();

    if (userError) {
      console.error('❌ LAYER 3 FAILED: Database error while checking user:', userError);
      return Response.redirect(`${origin}/dashboard?payment=failed&reason=database_error`, 302);
    }

    if (!userProfile) {
      console.error('❌ LAYER 3 FAILED: User not found in database:', userId);
      console.error('   User may have been deleted or never existed');
      return Response.redirect(`${origin}/dashboard?payment=failed&reason=user_not_found`, 302);
    }

    console.log('✅ LAYER 3 PASSED: User verified in database:', {
      name: userProfile.full_name,
      is_member: userProfile.is_member,
      is_name_locked: userProfile.is_name_locked,
    });

    // LAYER 4 (QUATERNARY): Validate transaction amount matches expectation
    // Note: We now charge expectedAmount + processing fee, so actual amount > expected
    const chargedAmount = Number(txData.amount);
    const processingFee = Number(txData.meta?.processing_fee ?? 10);
    
    // The amount to credit the user is the expected_amount (original amount without fee)
    const amount = expectedAmount ? Number(expectedAmount) : (chargedAmount - processingFee);
    
    console.log('💳 Charged amount from Flutterwave:', chargedAmount);
    console.log('💰 Expected amount (to credit):', amount);
    console.log('💸 Processing fee absorbed:', processingFee);
    
    if (expectedAmount) {
      const expectedAmountNum = Number(expectedAmount);
      const expectedChargedAmount = expectedAmountNum + Number(processingFee);
      
      // Allow small variance for rounding (within ₦1)
      if (Math.abs(chargedAmount - expectedChargedAmount) > 1) {
        console.error('❌ LAYER 4 FAILED: Amount mismatch detected!');
        console.error('   Received from Flutterwave:', chargedAmount);
        console.error('   Expected charge (amount + fee):', expectedChargedAmount);
        console.error('   Difference:', Math.abs(chargedAmount - expectedChargedAmount));
        console.error('   This indicates possible price manipulation or Flutterwave error');
        return Response.redirect(`${origin}/dashboard?payment=failed&reason=amount_mismatch`, 302);
      }
      console.log('✅ LAYER 4 PASSED: Amount validation successful');
    } else {
      console.warn('⚠️ LAYER 4 SKIPPED: No expected_amount in metadata, using charged - fee');
    }

    console.log('🎉 ALL 4 VERIFICATION LAYERS PASSED SUCCESSFULLY');
    console.log('👤 Processing payment for user:', userProfile.full_name);
    console.log('💰 Final validated amount:', amount);

    // If in test mode, skip all database operations
    if (TEST_MODE_WEBHOOK_ONLY) {
      console.log('🧪 TEST MODE: Callback is disabled, webhook will handle processing');
      console.log('✅ All verifications passed, but skipping database operations');
      console.log('↩️ Redirecting user to dashboard (webhook will process payment)');
      
      return Response.redirect(
        `${origin}/dashboard?payment=webhook_test&amount=${amount}&type=${paymentPurpose}`,
        302
      );
    }

    // Check for duplicate transaction
    console.log('🔍 Checking for duplicates...');
    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('payment_reference', params.tx_ref)
      .maybeSingle();

    if (existingTx) {
      console.log('⚠️ Transaction already processed (likely by webhook):', params.tx_ref);
      return Response.redirect(`${origin}/dashboard?payment=duplicate&amount=${amount}`, 302);
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
      .eq('id', userId)
      .single();

    // Check if user has any spots (for legacy member detection)
    const { count: spotCount } = await supabase
      .from('spots')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const hasNoSpots = (spotCount ?? 0) === 0;
    const isLegacyMember = profile?.is_member && hasNoSpots;

    console.log('📊 User spot status:', { 
      is_member: profile?.is_member, 
      spotCount, 
      hasNoSpots, 
      isLegacyMember 
    });

    let paymentType = 'deposit';
    let transactionData: any;
    let isMembershipActivation = false;
    let shouldCreateSpot = false;
    let isLegacyActivation = false;
    
    const _mfee = Number(config.membership_fee);
    const _extras = Math.max(0, Math.min(Number(txData.meta?.auto_buy_spots) || 0, 100));
    const _isBulkAmt = amount >= _mfee && amount === _mfee + _extras * loopAmount;
    const _isMembershipByPurpose = String(txData.meta?.purpose || '') === 'membership';
    if ((amount === _mfee || _isBulkAmt || _isMembershipByPurpose) && !profile?.is_member) {
      // NEW MEMBER PAYMENT - Money goes to USER's deposit wallet
      // buy-spot will then deduct it and distribute to the queue
      // Note: User paid amount + processing fee, but we credit only 'amount'
      paymentType = 'membership';
      isMembershipActivation = true;
      shouldCreateSpot = true; // Auto-create first spot on activation!
      console.log('✅ Processing NEW membership activation (routed to USER deposit wallet)');
      console.log('🎰 Will auto-create first spot in The Viketa Line!');
      console.log('💰 Crediting user:', amount, '(they paid:', chargedAmount, ')');
      
      transactionData = {
        user_id: userId,
        wallet_type: 'deposit',
          amount: loopAmount, // Only first spot money enters the user's wallet
        transaction_type: 'deposit',
          description: 'Activation payment for your first ad share',
        payment_reference: params.tx_ref,
        status: 'completed',
        metadata: {
          payment_purpose: 'membership',
          is_activation: true,
          charged_amount: chargedAmount,
          processing_fee: processingFee,
          activation_paid: amount,
          loop_amount: loopAmount,
        }
      };
    } else if (amount === Number(config.membership_fee) && isLegacyMember) {
      // LEGACY MEMBER - Already a member, just needs first spot!
      // Money goes to USER's deposit wallet, buy-spot deducts it
      paymentType = 'legacy_activation';
      isMembershipActivation = false; // Already a member, skip membership activation
      shouldCreateSpot = true; // But DO create their first spot!
      isLegacyActivation = true;
      console.log('🏛️ LEGACY MEMBER detected! Already is_member, but has 0 spots');
      console.log('✅ Processing LEGACY activation (routed to USER deposit wallet)');
      console.log('🎰 Will create their first spot in The Viketa Line!');
      console.log('💰 Crediting user:', amount, '(they paid:', chargedAmount, ')');
      
      transactionData = {
        user_id: userId,
        wallet_type: 'deposit',
          amount: loopAmount, // Only first spot money enters the user's wallet
        transaction_type: 'deposit',
        description: 'Legacy member activation credit',
        payment_reference: params.tx_ref,
        status: 'completed',
        metadata: {
          payment_purpose: 'legacy_activation',
          is_legacy_member: true,
          charged_amount: chargedAmount,
          processing_fee: processingFee,
          activation_paid: amount,
          loop_amount: loopAmount,
        }
      };
    } else {
      // REGULAR DEPOSIT
      console.log('✅ Processing regular deposit');
      console.log('💰 Crediting user:', amount, '(they paid:', chargedAmount, ')');
      
      transactionData = {
        user_id: userId,
        wallet_type: 'deposit',
        amount: amount, // Credit original amount, not charged amount
        transaction_type: 'deposit',
        description: 'Wallet deposit',
        payment_reference: params.tx_ref,
        status: 'completed',
        metadata: {
          payment_purpose: 'deposit',
          charged_amount: chargedAmount,
          processing_fee: processingFee
        }
      };
    }

    // Insert transaction
    const { error: insertError } = await supabase
      .from('transactions')
      .insert(transactionData);

    if (insertError) {
      // Check if duplicate constraint violation (23505 = unique_violation)
      if (insertError.code === '23505' || insertError.message?.includes('duplicate key')) {
        console.log('✅ Duplicate payment detected by database (webhook processed it first)');
        console.log('📋 Reference:', params.tx_ref);
        
        // Redirect to success - payment was already processed successfully
        return Response.redirect(
          `${origin}/dashboard?payment=success&amount=${amount}&type=${paymentType}&note=already_processed`,
          302
        );
      }
      
      // Real database error
      console.error('❌ Failed to insert transaction:', insertError);
      return Response.redirect(`${origin}/dashboard?payment=failed&reason=database_error`, 302);
    }

    console.log('✅ Payment processed successfully');

    // ===== AUTO-BUY SPOTS =====
    // For plain deposits: buy N spots from the credited deposit balance.
    // For bulk membership activation: credit the extras (₦drop_entry_fee × N)
    // to the deposit wallet, then auto-buy N spots on top of the first
    // activation spot.
    try {
      const requestedSpots = Number(txData.meta?.auto_buy_spots) || 0;
      if (requestedSpots > 0) {
        if (isMembershipActivation || isLegacyActivation) {
          const extrasRef = `${params.tx_ref}::activation_extras_credit`;
          const extrasAmt = loopAmount * requestedSpots;
          const { error: extrasErr } = await supabase.from('transactions').insert({
            user_id: userId,
            wallet_type: 'deposit',
            amount: extrasAmt,
            transaction_type: 'membership_bonus',
            description: `Activation top-up for ${requestedSpots} extra ad share${requestedSpots === 1 ? '' : 's'}`,
            status: 'completed',
            payment_reference: extrasRef,
            metadata: { purpose: 'spot_creation_credit', original_payment_ref: params.tx_ref, extras_count: requestedSpots },
          });
          if (!extrasErr || (extrasErr as any).code === '23505') {
            const { runAutoBuySpots } = await import('../_shared/autoBuySpots.ts');
            await runAutoBuySpots(supabase, { userId, paymentRef: `${params.tx_ref}::extras`, count: requestedSpots });
          }
        } else {
          const { runAutoBuySpots } = await import('../_shared/autoBuySpots.ts');
          await runAutoBuySpots(supabase, { userId, paymentRef: params.tx_ref, count: requestedSpots });
        }
      }
    } catch (autoBuyErr) {
      console.error('⚠️ auto-buy spots failed (non-critical):', autoBuyErr);
    }


    if (isMembershipActivation || isLegacyActivation) {
      console.log(`💰 Activation payment created: ₦${loopAmount} for first spot only`);
    }

    // ===== ACTIVATE MEMBERSHIP (set is_member = true) =====
    if (isMembershipActivation || isLegacyActivation) {
      console.log('👤 Activating membership for user:', userId);
      
      const { error: activateError } = await supabase
        .from('profiles')
        .update({ is_member: true })
        .eq('id', userId);
      
      if (activateError) {
        console.error('❌ Failed to activate membership:', activateError);
        // Continue anyway - they have paid and can contact support
      } else {
        console.log('✅ Membership activated successfully! is_member = true');
      }
    }
    
    // Mark payment attempt as verified (non-blocking)
    try {
      const { error: attemptError } = await supabase
        .from('payment_attempts')
        .update({ 
          status: 'verified', 
          verified_at: new Date().toISOString(),
          flutterwave_id: params.transaction_id
        })
        .eq('tx_ref', params.tx_ref);
      
      if (attemptError) {
        console.warn('⚠️ Could not update payment attempt (non-critical):', attemptError);
      } else {
        console.log('✅ Payment attempt marked as verified');
      }
    } catch (attemptError) {
      console.warn('⚠️ Payment attempt update failed (non-critical):', attemptError);
    }

    // ===== AUTO-CREATE FIRST SPOT VIA BUY-SPOT EDGE FUNCTION =====
    if (shouldCreateSpot) {
      try {
        console.log('🎰 Creating first spot via buy-spot Edge Function...');
        
        // Get platform config for drop settings
        const { data: dropConfig } = await supabase
          .from('platform_config')
          .select('drop_entry_fee, drop_target_amount, drop_system_active')
          .eq('id', 1)
          .single();

        if (dropConfig?.drop_system_active) {
          // Cache is auto-refreshed by trigger on transactions insert

          // User already has the activation credit in their deposit wallet from the transaction above
          // Call buy-spot Edge Function which handles everything:
          // - Deduct from wallet
          // - Create spot
          // - Create drop entry
          // - Trigger distribution
          console.log('🔄 Calling buy-spot Edge Function (user has funds in deposit wallet)...');
          
          const buySpotResponse = await fetch(`${supabaseUrl}/functions/v1/buy-spot`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              target_user_id: userId,
              source_wallet: 'deposit',
              skip_membership_check: true, // User was JUST activated, allow spot creation
            }),
          });

          const spotResult = await buySpotResponse.json();

          if (!buySpotResponse.ok || spotResult.error) {
            console.error('❌ buy-spot Edge Function failed:', spotResult.error);
          } else if (spotResult.success) {
            console.log('✅ Spot created via buy-spot:', spotResult.spot_id);
            console.log('📍 Position:', spotResult.position);
            console.log('✅ Distribution triggered automatically by buy-spot!');
            
            // ===== CREATE PENDING REFERRAL BONUS =====
            // Get profile to check for referrer
            const { data: userProfileForReferral } = await supabase
              .from('profiles')
              .select('referred_by_code')
              .eq('id', userId)
              .single();
            
            if (userProfileForReferral?.referred_by_code && 
                userProfileForReferral.referred_by_code !== 'SYSTEM' && 
                userProfileForReferral.referred_by_code !== '') {
              console.log('🎁 Paying instant referral bonus to referrer...');
              
              const { error: bonusError } = await supabase.rpc('pay_referrer_activation_bonus', {
                _referee_id: userId,
                _referred_by_code: userProfileForReferral.referred_by_code
              });
              
              if (bonusError) {
                console.error('⚠️ Failed to pay referral bonus (non-critical):', bonusError);
              } else {
                console.log('✅ Referral activation bonus paid instantly to referrer');
              }
            }
          }
        } else {
          console.log('⚠️ Drop system is not active, skipping spot creation');
        }
      } catch (spotCreationError) {
        console.error('⚠️ Spot creation failed (non-critical):', spotCreationError);
        // Don't fail the main flow - user is still activated
      }
    }
    
    // ===== SEND TELEGRAM ALERT FOR ACTIVATION (non-blocking) =====
    if (isMembershipActivation || isLegacyActivation) {
      try {
        console.log('📱 Sending Telegram activation alert...');
        
        // Get user's full profile for the alert
        const { data: fullProfile } = await supabase
          .from('profiles')
          .select('full_name, phone_number, referred_by_code')
          .eq('id', userId)
          .single();
        
        // Get user email from auth
        const { data: authData } = await supabase.auth.admin.getUserById(userId);
        const userEmail = authData?.user?.email || 'Unknown';
        
        // Get referrer info if exists
        let referrerName = null;
        
        if (fullProfile?.referred_by_code && fullProfile.referred_by_code !== 'SYSTEM') {
          const { data: referrer } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('referral_code', fullProfile.referred_by_code)
            .single();
          referrerName = referrer?.full_name;
        }
        
        // Call Telegram alert function (NO referrerBonus - it now works per-cycle)
        await supabase.functions.invoke('send-telegram-alert', {
          body: {
            alertType: 'activation',
            userName: fullProfile?.full_name || 'Unknown',
            userPhone: fullProfile?.phone_number,
            userEmail: userEmail,
            referrerCode: fullProfile?.referred_by_code,
            referrerName: referrerName,
            amount: amount,
            userId: userId,
          }
        });
        
        console.log('✅ Telegram activation alert sent');
      } catch (telegramError) {
        // Don't fail the main flow - just log the error
        console.error('⚠️ Telegram alert failed (non-critical):', telegramError);
      }
    }
    
    // ===== CREATE ADMIN IN-APP NOTIFICATION FOR ACTIVATION (non-blocking) =====
    if (isMembershipActivation || isLegacyActivation) {
      try {
        console.log('🔔 Creating admin notification for activation...');
        
        const { data: fullProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', userId)
          .single();
        
        await supabase.from('admin_notifications').insert({
          notification_type: 'member_activated',
          title: isLegacyActivation ? 'Legacy Member Activated!' : 'New Member Activated!',
          message: `${fullProfile?.full_name || 'A user'} just activated and got their first ad share!`,
          metadata: {
            user_id: userId,
            amount: amount,
            is_legacy: isLegacyActivation,
          },
          link: '/admin/users',
        });
        
        console.log('✅ Admin notification created for activation');
      } catch (notifError) {
        console.error('⚠️ Admin notification failed (non-critical):', notifError);
      }
    }
    
    console.log('↩️ Redirecting to dashboard with success message');

    // Notify connected browsers — funded balance / new spot may exist now.
    try {
      const { broadcastQueueChanged } = await import('../_shared/broadcastQueueChanged.ts');
      broadcastQueueChanged('payment_success').catch(() => {});
    } catch (_) {}

    // Redirect with success message
    return Response.redirect(
      `${origin}/dashboard?payment=success&amount=${amount}&type=${paymentType}`,
      302
    );

  } catch (error: any) {
    console.error('❌ Error in flutterwave-callback:', error);
    
    // Try to extract origin from URL for error redirect
    let origin = DEFAULT_SAFE_ORIGIN;
    try {
      const url = new URL(req.url);
      origin = getSafeRedirectOrigin(url.searchParams.get('origin'));
    } catch {}

    return Response.redirect(
      `${origin}/dashboard?payment=failed&reason=server_error`,
      302
    );
  }
});
