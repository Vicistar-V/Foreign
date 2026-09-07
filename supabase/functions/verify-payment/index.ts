import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { safeJson } from '../_shared/safe-json.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// 🔐 PAYMENT VERIFICATION FUNCTION
// For users whose callback failed (network issues, browser closed, etc.)
// Now supports: tx_ref lookup via payment_attempts table
// ============================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 verify-payment: Starting payment verification...');

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'You must be logged in to verify payments' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get requesting user
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      console.error('❌ Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Could not verify your account' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('👤 Requesting user:', user.id);

    // Get request body
    const body = await req.json();
    const { transaction_id, tx_ref, attempt_id } = body;

    // ============================================
    // STEP 0: Resolve tx_ref from attempt_id if provided
    // ============================================
    let resolvedTxRef = tx_ref;
    let paymentAttempt = null;

    if (attempt_id) {
      console.log('🔍 Looking up payment attempt:', attempt_id);
      
      const { data: attempt, error: attemptError } = await supabase
        .from('payment_attempts')
        .select('*')
        .eq('id', attempt_id)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (attemptError || !attempt) {
        console.error('❌ Payment attempt not found:', attempt_id);
        return new Response(
          JSON.stringify({ 
            status: 'not_found',
            message: 'This payment attempt was not found in your account.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Check if already verified
      if (attempt.status === 'verified') {
        console.log('✅ Payment attempt already verified');
        return new Response(
          JSON.stringify({ 
            status: 'already_done',
            message: attempt.purpose === 'membership' 
              ? 'This membership payment was already processed!'
              : 'This deposit was already processed!'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (attempt.status === 'failed') {
        console.log('❌ Payment attempt was marked as failed');
        return new Response(
          JSON.stringify({ 
            status: 'failed',
            message: 'This payment failed. Please make a new payment.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      resolvedTxRef = attempt.tx_ref;
      paymentAttempt = attempt;
      console.log('✅ Found tx_ref from attempt:', resolvedTxRef);
    }

    // Need at least one identifier
    if (!transaction_id && !resolvedTxRef) {
      return new Response(
        JSON.stringify({ 
          error: 'Please provide your Flutterwave transaction ID',
          hint: 'You can find this in your bank SMS or Flutterwave email'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 Looking up payment:', { transaction_id, tx_ref: resolvedTxRef });

    // ============================================
    // STEP 1: Check if already processed in our database
    // ============================================
    let existingTx = null;
    
    if (resolvedTxRef) {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('payment_reference', resolvedTxRef)
        .maybeSingle();
      existingTx = data;
    }

    if (existingTx) {
      console.log('✅ Payment already processed:', resolvedTxRef);
      
      // Check if payment belongs to this user or was a membership payment
      const belongsToUser = existingTx.user_id === user.id || 
        existingTx.metadata?.original_user_id === user.id;
      
      if (!belongsToUser) {
        console.warn('⚠️ User trying to verify someone else\'s payment');
        return new Response(
          JSON.stringify({ 
            status: 'not_found',
            message: 'This payment does not belong to your account'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mark attempt as verified if we have one
      if (paymentAttempt) {
        await supabase
          .from('payment_attempts')
          .update({ 
            status: 'verified', 
            verified_at: new Date().toISOString(),
            flutterwave_id: transaction_id || existingTx.metadata?.flutterwave_id
          })
          .eq('id', paymentAttempt.id);
      }

      // Check the status
      if (existingTx.status === 'completed') {
        // Check if user is now a member (for membership payments)
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_member')
          .eq('id', user.id)
          .single();

        return new Response(
          JSON.stringify({ 
            status: 'already_done',
            message: profile?.is_member 
              ? 'Your membership is already active! You can start picking pictures today.'
              : 'This payment was already processed successfully.',
            is_member: profile?.is_member
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (existingTx.status === 'failed') {
        return new Response(
          JSON.stringify({ 
            status: 'failed',
            message: 'This payment failed. Please try making a new payment.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ============================================
    // STEP 2: Verify with payment provider
    // ============================================
    let verificationData: any;

    // PAYSTACK BRANCH ── normalize Paystack's response into a Flutterwave-shape
    // so the downstream validation/processing works unchanged.
    if (paymentAttempt?.provider === 'paystack') {
      console.log('🔐 Verifying via Paystack...');
      const paystackKey = Deno.env.get('PAYSTACK_SECRET_KEY');
      if (!paystackKey) {
        return new Response(
          JSON.stringify({ error: 'Paystack not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const psResp = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(resolvedTxRef)}`,
        { headers: { Authorization: `Bearer ${paystackKey}`, 'Content-Type': 'application/json' } }
      );
      const psParsed = await safeJson<any>(psResp);
      if (!psParsed.ok) {
        console.error('❌ Paystack verify gateway error:', psParsed.error);
        return new Response(
          JSON.stringify({ status: 'gateway_unavailable', message: 'Paystack is temporarily unavailable. Please try again in a moment.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const psJson = psParsed.data;
      if (!psResp.ok || psJson.status !== true || !psJson.data) {
        if (paymentAttempt && psResp.status === 404) {
          await supabase
            .from('payment_attempts')
            .update({ status: 'failed', verified_at: new Date().toISOString() })
            .eq('id', paymentAttempt.id);
        }
        return new Response(
          JSON.stringify({
            status: 'not_found',
            message: 'This Paystack payment was not found. It may not have been completed yet.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const ps = psJson.data;
      verificationData = {
        data: {
          id: ps.id,
          status: ps.status === 'success' ? 'successful' : ps.status,
          tx_ref: ps.reference,
          amount: Number(ps.amount) / 100, // kobo → naira
          currency: ps.currency,
          customer: { email: ps.customer?.email, name: ps.customer?.first_name || '' },
          meta: ps.metadata || {},
        },
      };
    } else {
      // FLUTTERWAVE BRANCH (existing behavior)
      console.log('🔐 Calling Flutterwave Verify API...');
      const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY');

      if (!flutterwaveSecretKey) {
        console.error('❌ FLUTTERWAVE_SECRET_KEY not configured');
        return new Response(
          JSON.stringify({ error: 'Payment verification not available' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }


    
    if (transaction_id) {
      // Direct verification by transaction ID
      const verifyUrl = `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`;
      
      const verifyResponse = await fetch(verifyUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${flutterwaveSecretKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!verifyResponse.ok) {
        const errorText = await verifyResponse.text();
        console.error('❌ Flutterwave API error:', verifyResponse.status, errorText);
        
        if (verifyResponse.status === 404) {
          // Mark attempt as failed if not found
          if (paymentAttempt) {
            await supabase
              .from('payment_attempts')
              .update({ status: 'failed', verified_at: new Date().toISOString() })
              .eq('id', paymentAttempt.id);
          }
          
          return new Response(
            JSON.stringify({ 
              status: 'not_found',
              message: 'This transaction ID was not found in Flutterwave. Please check the number and try again.'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ 
            error: 'Could not verify with payment provider',
            hint: 'Please try again in a few minutes'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const fwVerifyParsed = await safeJson<any>(verifyResponse);
      if (!fwVerifyParsed.ok) {
        console.error('❌ Flutterwave verify gateway error:', fwVerifyParsed.error);
        return new Response(
          JSON.stringify({ status: 'gateway_unavailable', message: 'Flutterwave is temporarily unavailable. Please try again in a moment.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      verificationData = fwVerifyParsed.data;
    } else if (resolvedTxRef) {
      // Search by tx_ref
      console.log('🔍 Searching Flutterwave by tx_ref:', resolvedTxRef);
      
      const searchUrl = `https://api.flutterwave.com/v3/transactions?tx_ref=${encodeURIComponent(resolvedTxRef)}`;
      
      const searchResponse = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${flutterwaveSecretKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!searchResponse.ok) {
        console.error('❌ Flutterwave search error:', searchResponse.status);
        return new Response(
          JSON.stringify({ 
            error: 'Could not verify with payment provider',
            hint: 'Please try again in a few minutes'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const fwSearchParsed = await safeJson<any>(searchResponse);
      if (!fwSearchParsed.ok) {
        console.error('❌ Flutterwave search gateway error:', fwSearchParsed.error);
        return new Response(
          JSON.stringify({ status: 'gateway_unavailable', message: 'Flutterwave is temporarily unavailable. Please try again in a moment.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const searchData = fwSearchParsed.data;
      console.log('📊 Flutterwave search result:', JSON.stringify(searchData, null, 2));
      
      if (!searchData.data || searchData.data.length === 0) {
        console.log('❌ No transaction found with tx_ref:', resolvedTxRef);
        return new Response(
          JSON.stringify({ 
            status: 'not_found',
            message: 'This payment was not found. It may not have been completed yet.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
        // Use the first (most recent) transaction
        verificationData = { data: searchData.data[0] };
      }
    } // end FLUTTERWAVE BRANCH

    console.log('✅ Provider response:', JSON.stringify(verificationData, null, 2));

    const txData = verificationData.data;
    const flutterwaveId = txData.id;

    // ============================================
    // STEP 3: Validate the payment
    // ============================================
    
    // Check status
    if (txData.status !== 'successful') {
      console.log('❌ Payment not successful:', txData.status);
      
      // Mark attempt as failed if not successful
      if (paymentAttempt && txData.status === 'failed') {
        await supabase
          .from('payment_attempts')
          .update({ status: 'failed', verified_at: new Date().toISOString() })
          .eq('id', paymentAttempt.id);
      }
      
      return new Response(
        JSON.stringify({ 
          status: txData.status === 'pending' ? 'pending' : 'failed',
          message: txData.status === 'pending' 
            ? 'This payment is still being processed. Please wait a few minutes and try again.'
            : 'This payment was not successful. Please try making a new payment.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Verify this payment belongs to the requesting user
    const paymentUserId = txData.meta?.user_id;
    
    if (!paymentUserId) {
      console.warn('⚠️ Payment has no user_id in metadata - suspicious');
      return new Response(
        JSON.stringify({ 
          status: 'invalid',
          message: 'This payment cannot be verified. It was not made through our system.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (paymentUserId !== user.id) {
      console.warn('⚠️ User trying to claim someone else\'s payment!');
      console.warn('   Payment user_id:', paymentUserId);
      console.warn('   Requesting user:', user.id);
      return new Response(
        JSON.stringify({ 
          status: 'not_yours',
          message: 'This payment belongs to a different account. Please verify with the correct account.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check currency
    if (txData.currency !== 'NGN') {
      console.error('❌ Invalid currency:', txData.currency);
      return new Response(
        JSON.stringify({ 
          status: 'invalid',
          message: 'This payment was not made in Nigerian Naira.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // STEP 4: Check for duplicates (by tx_ref from Flutterwave)
    // ============================================
    const flutterwaveTxRef = txData.tx_ref;
    
    const { data: duplicateCheck } = await supabase
      .from('transactions')
      .select('id, status')
      .eq('payment_reference', flutterwaveTxRef)
      .maybeSingle();

    if (duplicateCheck) {
      console.log('⚠️ Payment already processed (found by tx_ref):', flutterwaveTxRef);
      
      // Mark attempt as verified
      if (paymentAttempt) {
        await supabase
          .from('payment_attempts')
          .update({ 
            status: 'verified', 
            verified_at: new Date().toISOString(),
            flutterwave_id: flutterwaveId?.toString()
          })
          .eq('id', paymentAttempt.id);
      }
      
      // Check if user is a member
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_member')
        .eq('id', user.id)
        .single();

      return new Response(
        JSON.stringify({ 
          status: 'already_done',
          message: profile?.is_member 
            ? 'Your membership is already active! You can start picking pictures today.'
            : 'This payment was already processed.',
          is_member: profile?.is_member
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // STEP 5: Process the payment
    // ============================================
    console.log('💳 Processing verified payment...');
    
    // Extract the original amount from metadata (what user should receive)
    const chargedAmount = txData.amount;
    const processingFee = txData.meta?.processing_fee || 10;
    const expectedAmountFromMeta = txData.meta?.expected_amount;
    const amount = expectedAmountFromMeta ? Number(expectedAmountFromMeta) : (chargedAmount - processingFee);
    
    console.log('💳 Charged amount:', chargedAmount);
    console.log('💰 Credit amount:', amount);
    console.log('💸 Processing fee absorbed:', processingFee);
    
    const paymentPurpose = txData.meta?.purpose || paymentAttempt?.purpose || 'deposit';
    
    // Get platform config
    const { data: config } = await supabase
      .from('platform_config')
      .select('membership_fee, drop_entry_fee')
      .eq('id', 1)
      .single();

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_member, full_name')
      .eq('id', user.id)
      .single();

    let isMembershipActivation = false;
    let transactionData: any;

    // Determine if this is a membership payment
    const isMembershipPayment = paymentPurpose === 'membership' || 
      (amount === Number(config?.membership_fee) && !profile?.is_member);

    if (isMembershipPayment && !profile?.is_member) {
      isMembershipActivation = true;
      console.log('✅ Processing membership activation');

      transactionData = {
        user_id: user.id,
        wallet_type: 'earnings',
        amount: 0,
        transaction_type: 'membership_fee',
        description: 'Membership activation',
        payment_reference: flutterwaveTxRef,
        status: 'completed',
        metadata: {
          payment_purpose: 'membership',
          verified_manually: true,
          flutterwave_id: flutterwaveId,
          verified_at: new Date().toISOString(),
          charged_amount: chargedAmount,
          processing_fee: processingFee,
          paid_amount: amount,
        },
      };
    } else {
      // REGULAR DEPOSIT
      console.log('✅ Processing deposit');
      console.log('💰 Crediting:', amount, '(they paid:', chargedAmount, ')');
      
      transactionData = {
        user_id: user.id,
        wallet_type: 'deposit',
        amount: amount, // Credit original amount, not charged amount
        transaction_type: 'deposit',
        description: 'Wallet deposit',
        payment_reference: flutterwaveTxRef,
        status: 'completed',
        metadata: {
          payment_purpose: 'deposit',
          verified_manually: true,
          flutterwave_id: flutterwaveId,
          verified_at: new Date().toISOString(),
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
      // Check if duplicate (23505 = unique_violation)
      if (insertError.code === '23505' || insertError.message?.includes('duplicate key')) {
        console.log('⚠️ Duplicate detected during insert');
        
        // Mark attempt as verified
        if (paymentAttempt) {
          await supabase
            .from('payment_attempts')
            .update({ 
              status: 'verified', 
              verified_at: new Date().toISOString(),
              flutterwave_id: flutterwaveId?.toString()
            })
            .eq('id', paymentAttempt.id);
        }
        
        return new Response(
          JSON.stringify({ 
            status: 'already_done',
            message: 'This payment was already processed.',
            is_member: isMembershipActivation || profile?.is_member
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.error('❌ Database error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Could not process payment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Payment processed successfully!');

    // ===== AUTO-BUY SPOTS =====
    // Plain deposit: buy N spots from credited balance.
    // Bulk membership activation: credit extras (drop_entry_fee × N) to deposit, then auto-buy.
    try {
      const requestedSpots = Number((txData as any).meta?.auto_buy_spots) || 0;
      if (requestedSpots > 0) {
        const loopAmount = Number(config?.drop_entry_fee || 5000);
        if (isMembershipActivation) {
          const extrasRef = `${flutterwaveTxRef}::activation_extras_credit`;
          const extrasAmt = loopAmount * requestedSpots;
          const { error: extrasErr } = await supabase.from('transactions').insert({
            user_id: user.id,
            wallet_type: 'deposit',
            amount: extrasAmt,
            transaction_type: 'membership_bonus',
            description: `Activation top-up for ${requestedSpots} extra ad share${requestedSpots === 1 ? '' : 's'}`,
            status: 'completed',
            payment_reference: extrasRef,
            metadata: { purpose: 'spot_creation_credit', original_payment_ref: flutterwaveTxRef, extras_count: requestedSpots },
          });
          if (!extrasErr || (extrasErr as any).code === '23505') {
            const { runAutoBuySpots } = await import('../_shared/autoBuySpots.ts');
            await runAutoBuySpots(supabase, { userId: user.id, paymentRef: `${flutterwaveTxRef}::extras`, count: requestedSpots });
          }
        } else {
          const { runAutoBuySpots } = await import('../_shared/autoBuySpots.ts');
          await runAutoBuySpots(supabase, { userId: user.id, paymentRef: flutterwaveTxRef, count: requestedSpots });
        }
      }
    } catch (autoBuyErr) {
      console.error('⚠️ auto-buy spots failed (non-critical):', autoBuyErr);
    }


    // Mark payment attempt as verified
    if (paymentAttempt) {
      await supabase
        .from('payment_attempts')
        .update({ 
          status: 'verified', 
          verified_at: new Date().toISOString(),
          flutterwave_id: flutterwaveId?.toString()
        })
        .eq('id', paymentAttempt.id);
    }

    // ===== MEMBERSHIP ACTIVATION: Set is_member, create spot, pending bonus =====
    if (isMembershipActivation) {
      try {
        // Step 1: Set is_member = true
        console.log('👤 Setting is_member = true for user:', user.id);
        const { error: memberError } = await supabase
          .from('profiles')
          .update({ 
            is_member: true,
          })
          .eq('id', user.id);
        
        if (memberError) {
          console.error('❌ Failed to set is_member:', memberError);
          // This is critical - we should not continue
          throw new Error('Failed to activate membership');
        }
        console.log('✅ is_member set to true');

        // Step 2: Create first spot for the user via buy-spot Edge Function
        console.log('🎰 Creating first spot via buy-spot Edge Function...');

        // Only the first spot money enters the user's wallet.
        // The rest was paid to the business and is not recorded in any wallet.
        const loopAmount = Number(config?.drop_entry_fee || 5000);
        console.log(`💰 Activation payment: ₦${loopAmount} for first spot only`);

        // Credit ONLY the first spot amount — STRICT IDEMPOTENCY via deterministic payment_reference.
        // If webhook already inserted this credit, the unique index on transactions.payment_reference
        // will reject this insert (23505) and we skip buy-spot to prevent a duplicate spot.
        const activationCreditRef = `${flutterwaveTxRef}::activation_credit`;
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
              original_payment_ref: flutterwaveTxRef,
              activation_paid: amount,
              loop_amount: loopAmount,
            }
          });

        if (creditError) {
          if (creditError.code === '23505' || creditError.message?.includes('duplicate key')) {
            console.log('✅ Activation payment already inserted by webhook — skipping buy-spot to avoid double spot.');
          } else {
            console.error('⚠️ Failed to credit deposit for spot:', creditError);
          }
        } else {
          // Cache is auto-refreshed by trigger on transactions insert
          // Call buy-spot Edge Function (handles spot creation + distribution)
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
            console.error('⚠️ buy-spot Edge Function failed:', errorText);
          } else {
            const spotResult = await buySpotResponse.json();
            console.log('✅ First spot created via buy-spot:', spotResult);
          }
        }

        // Step 3: Create pending referral bonus if user was referred
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('referred_by_code')
          .eq('id', user.id)
          .single();
        
        if (userProfile?.referred_by_code && 
            userProfile.referred_by_code !== 'SYSTEM' && 
            userProfile.referred_by_code !== '') {
          console.log('🎁 Paying instant referral bonus to referrer...');
          
          // FLAT PRICING: the invite bonus is paid PER SHARE the friend
          // activated on day one (first share + any bulk extras).
          const activatedShares =
            1 + Math.max(0, Math.min(Number((txData as any).meta?.auto_buy_spots) || 0, 100));
          const { error: bonusError } = await supabase.rpc('pay_referrer_activation_bonus', {
            _referee_id: user.id,
            _referred_by_code: userProfile.referred_by_code,
            _shares: activatedShares
          });
          
          if (bonusError) {
            console.error('⚠️ Failed to pay referral bonus (non-critical):', bonusError);
          } else {
            console.log('✅ Instant referral bonus paid to referrer');
          }
        }
      } catch (membershipError) {
        console.error('❌ Membership activation failed:', membershipError);
        // Don't throw - the payment was recorded, we can fix membership manually
      }
    }

    // Send Telegram alert for membership activation (non-blocking)
    if (isMembershipActivation) {
      try {
        console.log('📱 Sending Telegram activation alert...');
        
        await supabase.functions.invoke('send-telegram-alert', {
          body: {
            alertType: 'activation',
            userName: profile?.full_name || 'Unknown',
            userEmail: user.email,
            amount: amount,
            userId: user.id,
            note: 'Activated via manual verification'
          }
        });
        
        console.log('✅ Telegram alert sent');
      } catch (telegramError) {
        console.error('⚠️ Telegram alert failed (non-critical):', telegramError);
      }
    }

    // Return success
    return new Response(
      JSON.stringify({ 
        status: 'processed_now',
        message: isMembershipActivation 
          ? "You're in! Welcome to Viketa. Your ad share is working — start picking pictures today."
          : `₦${amount.toLocaleString()} has been added to your deposit wallet.`,
        is_member: isMembershipActivation || profile?.is_member,
        amount: amount,
        type: isMembershipActivation ? 'membership' : 'deposit'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('💥 verify-payment error:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Something went wrong. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
