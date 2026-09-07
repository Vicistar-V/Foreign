import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let reference: string | undefined;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized', errorCode: 'UNAUTHORIZED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized', errorCode: 'UNAUTHORIZED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { amount, pin } = await req.json();
    
    // Generate unique reference
    reference = `WD-${Date.now()}-${user.id.substring(0, 8)}`;

    console.log(`Withdrawal request from user ${user.id} for ₦${amount}`);

    // Check user profile (banned status + membership + name for later verification)
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('is_banned, banned_reason, is_member, full_name')
      .eq('id', user.id)
      .single();

    if (userProfile?.is_banned) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Your account has been suspended',
          reason: userProfile.banned_reason || 'Account violation detected',
          errorCode: 'BANNED'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL BUSINESS LOGIC: Membership check for EARNINGS withdrawals.
    // Non-members cannot withdraw bonuses (prevents infinite-money glitch:
    // fake accounts pocketing the referral bonus without ever paying the
    // membership fee). The exact fee is read from platform_config so this
    // error stays accurate as pricing changes.
    if (!userProfile?.is_member) {
      console.log('❌ Withdrawal blocked - user is not a member:', user.id);
      const { data: feeCfg } = await supabase
        .from('platform_config')
        .select('membership_fee')
        .eq('id', 1)
        .single();
      const membershipFee = Number(feeCfg?.membership_fee ?? 5000);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Activate Membership First',
          details: `You must pay the ₦${membershipFee.toLocaleString()} membership fee before you can withdraw your earnings. This protects the community from fraud.`,
          errorCode: 'NOT_MEMBER'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify PIN using edge function
    const { data: pinResponse, error: pinError } = await supabase.functions.invoke('verify-pin', {
      body: { pin },
      headers: { Authorization: authHeader },
    });

    if (pinError || !pinResponse?.valid) {
      console.error('PIN verification failed:', pinError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid PIN', errorCode: 'INVALID_PIN' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get platform config including withdrawal mode and status
    const { data: config } = await supabase
      .from('platform_config')
      .select('minimum_withdrawal, withdrawals_enabled, maintenance_mode, withdrawal_fee, manual_withdrawal_mode')
      .eq('id', 1)
      .single();

    // Priority 1: Check maintenance mode FIRST
    if (config.maintenance_mode) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Platform is under maintenance',
          details: 'We are making improvements to serve you better. Please check back shortly.',
          reason: 'maintenance_mode',
          errorCode: 'MAINTENANCE'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Priority 2: Check if withdrawals specifically are disabled
    if (!config.withdrawals_enabled) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Withdrawals are temporarily disabled',
          details: 'We are experiencing technical difficulties with payments. Please try again later.',
          reason: 'withdrawals_disabled',
          errorCode: 'WITHDRAWALS_DISABLED'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (amount < Number(config.minimum_withdrawal)) {
      return new Response(
        JSON.stringify({ success: false, error: `Minimum withdrawal is ₦${config.minimum_withdrawal}`, errorCode: 'VALIDATION_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check earnings balance
    const { data: earningsBalance } = await supabase.rpc('check_balance', {
      _user_id: user.id,
      _wallet_type: 'earnings'
    });

    if (Number(earningsBalance) < amount) {
      return new Response(
        JSON.stringify({ success: false, error: 'Insufficient funds', errorCode: 'INSUFFICIENT_FUNDS' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for negative balances (debt gate) - uses cache for display check only
    // Note: actual withdrawal uses check_balance() RPC for real ledger balance
    const { data: balances } = await supabase
      .from('cached_balances')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (balances.earnings_balance < 0 || balances.deposit_balance < 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Please clear your account debt first', errorCode: 'DEBT_GATE' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get primary bank account (must have bank_code)
    const { data: bankAccount, error: bankError } = await supabase
      .from('withdrawal_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .eq('is_verified', true)
      .single();

    if (bankError || !bankAccount) {
      return new Response(
        JSON.stringify({ success: false, error: 'No verified bank account found. Please add one first.', errorCode: 'NO_BANK_ACCOUNT' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify bank_code exists (required for transfer)
    if (!bankAccount.bank_code) {
      console.error('Bank account missing bank_code:', bankAccount);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Bank account data incomplete. Please add your bank account again.',
          details: 'Missing bank code - this account was added before the fix was applied.',
          errorCode: 'INCOMPLETE_BANK_DATA'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // FRAUD PREVENTION: Check if this bank account is used by another user
    // Prevents one person from creating multiple accounts and withdrawing to same bank
    // Scenario: Fraudster creates accounts A, B, C, all trying to withdraw to same bank account
    // This catches that pattern and blocks it
    const { data: duplicateBankCheck } = await supabase
      .from('withdrawal_accounts')
      .select('user_id, account_number')
      .eq('account_number', bankAccount.account_number)
      .eq('is_verified', true)
      .neq('user_id', user.id);

    if (duplicateBankCheck && duplicateBankCheck.length > 0) {
      console.log('🚨 FRAUD ALERT: Duplicate bank account detected:', {
        account_number: bankAccount.account_number,
        requesting_user: user.id,
        existing_users: duplicateBankCheck.map(d => d.user_id)
      });
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Bank Account Already Registered',
          details: 'This bank account is already linked to another Viketa account. Each bank account can only be used by one person.',
          errorCode: 'FRAUD_DUPLICATE_BANK'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify name match using flexible logic (same as add-bank-account)
    // Use profile data we already fetched earlier (line 42-46)

    // Smart name matching - check if all profile name parts exist in bank name (any order, case insensitive)
    const profileNameParts = userProfile.full_name.toLowerCase().trim().split(/\s+/);
    const bankNameLower = bankAccount.account_name.toLowerCase();

    const allPartsMatch = profileNameParts.every((part: string) => bankNameLower.includes(part));

    if (!allPartsMatch) {
      console.log('❌ Name mismatch during withdrawal:', {
        profile_name: userProfile.full_name,
        bank_account_name: bankAccount.account_name,
        profile_parts: profileNameParts,
        all_parts_found: allPartsMatch
      });
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Name mismatch between profile and bank account',
          details: `Profile name "${userProfile.full_name}" doesn't match bank account name "${bankAccount.account_name}"`,
          errorCode: 'NAME_MISMATCH'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Name verification passed for withdrawal:', {
      profile_name: userProfile.full_name,
      bank_account_name: bankAccount.account_name
    });

    // Calculate withdrawal fee and transfer amount
    const withdrawalFee = Number(config.withdrawal_fee) || 50;
    const transferAmount = amount - withdrawalFee;

    // Validate transfer amount is positive
    if (transferAmount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: `Amount must be greater than withdrawal fee (₦${withdrawalFee})`, errorCode: 'VALIDATION_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`💰 Withdrawal breakdown: Total ₦${amount} = Transfer ₦${transferAmount} + Fee ₦${withdrawalFee}`);

    // =====================================================
    // 🚀 MASTER ATOMIC WITHDRAWAL - ALL OR NOTHING
    // Single RPC call handles:
    // - User Debit + System Fee Credit + Pending Record
    // If ANY operation fails, EVERYTHING rolls back
    // =====================================================
    console.log(`🚀 MASTER ATOMIC: Initiating withdrawal ${reference}`);
    
    const { data: withdrawalResult, error: withdrawalError } = await supabase.rpc('atomic_initiate_withdrawal', {
      _user_id: user.id,
      _amount: amount,
      _fee: withdrawalFee,
      _reference: reference,
      _bank_name: bankAccount.bank_name
    });

    if (withdrawalError) {
      console.error('❌ CRITICAL: Master atomic withdrawal failed:', withdrawalError);
      
      // 🚨 CRITICAL ALERT: Notify admin of withdrawal system failure
      const { sendCriticalAlert } = await import('../_shared/sendCriticalAlert.ts');
      
      await sendCriticalAlert(supabase, 'withdrawal_failed', {
        user_id: user.id,
        amount: amount,
        reference: reference,
        error: withdrawalError.message,
        timestamp: new Date().toISOString(),
        failure_stage: 'atomic_withdrawal_initiation',
        bank_details: {
          bank_name: bankAccount.bank_name,
          account_number: bankAccount.account_number.substring(0, 4) + '****' // Masked for security
        }
      });
      
      throw new Error(`Withdrawal initiation rolled back: ${withdrawalError.message}`);
    }

    console.log(`✅ MASTER ATOMIC SUCCESS:`, withdrawalResult);

    // =====================================================
    // 🔄 MANUAL MODE CHECK - Skip Flutterwave if enabled
    // =====================================================
    if (config.manual_withdrawal_mode) {
      console.log(`📋 MANUAL MODE: Withdrawal ${reference} is pending admin approval`);
      
      // Store metadata indicating this is a manual withdrawal
      await supabase
        .from('transactions')
        .update({
          metadata: {
            is_manual: true,
            manual_mode: true,
            withdrawal_fee: withdrawalFee,
            transfer_amount: transferAmount,
            full_amount: amount,
            bank_name: bankAccount.bank_name,
            bank_code: bankAccount.bank_code,
            account_number: bankAccount.account_number,
            account_name: bankAccount.account_name,
            awaiting_admin_approval: true,
            initiated_at: new Date().toISOString()
          }
        })
        .eq('payment_reference', reference);
      
      // 📱 TELEGRAM ALERT: Notify admin of manual withdrawal request
      try {
        console.log('📱 Sending Telegram manual withdrawal alert...');
        await supabase.functions.invoke('send-telegram-alert', {
          body: {
            alertType: 'manual_withdrawal',
            userName: userProfile.full_name,
            userPhone: user.phone || 'Not provided',
            userEmail: user.email,
            userId: user.id,
            amount: amount,
            transferAmount: transferAmount,
            withdrawalFee: withdrawalFee,
            bankName: bankAccount.bank_name,
            accountNumber: bankAccount.account_number,
            accountName: bankAccount.account_name,
            reference: reference
          }
        });
        console.log('✅ Telegram manual withdrawal alert sent');
      } catch (telegramError) {
        console.error('⚠️ Telegram alert failed (non-critical):', telegramError);
      }
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Your withdrawal request has been submitted. An admin will process it and you will be notified when complete.',
          reference,
          manual_mode: true,
          transfer_amount: transferAmount
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================================================
    // 🚀 AUTOMATIC MODE - Call Flutterwave Transfer API
    // =====================================================
    const flutterwaveKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
    
    console.log('🚀 Calling Flutterwave Transfer API with:', {
      account_number: bankAccount.account_number,
      account_bank: bankAccount.bank_code,
      amount: transferAmount,
      currency: 'NGN',
      reference: reference,
      bank_name_stored: bankAccount.bank_name,
    });
    
    const transferResponse = await fetch('https://api.flutterwave.com/v3/transfers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${flutterwaveKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        account_bank: bankAccount.bank_code,
        account_number: bankAccount.account_number,
        amount: transferAmount,
        narration: `Viketa withdrawal ${reference}`,
        currency: 'NGN',
        reference: reference,
        debit_currency: 'NGN'
      })
    });

    const transferData = await transferResponse.json();
    
    if (transferResponse.ok) {
      console.log('✅ Transfer initiated:', transferData);
      
      // Store Flutterwave transfer ID for verification
      const flutterwaveTransferId = transferData.data?.id;
      
      if (flutterwaveTransferId) {
        await supabase
          .from('transactions')
          .update({
            metadata: {
              flutterwave_transfer_id: flutterwaveTransferId,
              withdrawal_fee: withdrawalFee,
              transfer_amount: transferAmount,
              full_amount: amount,
              initiated_at: new Date().toISOString()
            }
          })
          .eq('payment_reference', reference);
      }
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Withdrawal processing. Check status anytime.',
          reference,
          transactionId: flutterwaveTransferId
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.error('Transfer failed:', transferData);
      
      // Mark original withdrawal as failed
      await supabase
        .from('transactions')
        .update({ 
          status: 'failed',
          metadata: {
            failure_reason: transferData.message || 'Transfer creation failed',
            failed_at: new Date().toISOString()
          }
        })
        .eq('payment_reference', reference);
      
      // REFUND NEEDED! Refund the exact amount user was debited (amount already includes fee consideration)
      // The system fee was credited separately, so we reverse that too
      const withdrawalFee = Number(config.withdrawal_fee) || 50;
      
      // Refund user the exact debit amount
      await supabase.from('transactions').insert({
        user_id: user.id,
        wallet_type: 'earnings',
        amount: amount, // Refund exactly what was debited, NOT amount + fee
        transaction_type: 'debt_reversal',
        description: `Withdrawal failed - refund (Ref: ${reference})`,
        status: 'completed',
        metadata: {
          original_reference: reference,
          refund_reason: 'transfer_creation_failed',
          withdrawal_amount: amount
        }
      });
      
      // System treasury removed — no fee reversal entry needed.

      
      // Invalidate cache
      await supabase.from('cached_balances').delete().eq('user_id', user.id);
      
      console.log('✅ Withdrawal failed - refunded amount:', amount, '+ reversed fee:', withdrawalFee);

      // 📱 TELEGRAM ALERT: Notify admin of automated withdrawal failure
      try {
        console.log('📱 Sending Telegram withdrawal failure alert...');
        await supabase.functions.invoke('send-telegram-alert', {
          body: {
            alertType: 'withdrawal_failed',
            userName: userProfile.full_name,
            userId: user.id,
            amount: amount,
            bankName: bankAccount.bank_name,
            reference: reference,
            errorMessage: transferData.message || 'Flutterwave transfer creation failed',
            failureStage: 'flutterwave_api_call'
          }
        });
        console.log('✅ Telegram withdrawal failure alert sent');
      } catch (telegramError) {
        console.error('⚠️ Telegram alert failed (non-critical):', telegramError);
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Withdrawal failed. Please try again.', errorCode: 'TRANSFER_FAILED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('❌ CRITICAL: Error in initiate-withdrawal:', error);

    // 🚨 CRITICAL ALERT: Notify admin of withdrawal system failure
    const { sendCriticalAlert } = await import('../_shared/sendCriticalAlert.ts');
    
    await sendCriticalAlert(supabase, 'withdrawal_failed', {
      user_id: 'unknown', // Will be filled in below if we have reference
      amount: 0,
      reference: reference || 'unknown',
      error: error.message,
      timestamp: new Date().toISOString(),
      failure_stage: 'withdrawal_error_handler',
      stack_trace: error.stack
    });
    
    // If we created a pending transaction, mark it as failed and refund
    if (reference) {
      console.log('🔄 Handling error - marking transaction as failed and refunding');
      
      try {
        // Get transaction details
        const { data: txData } = await supabase
          .from('transactions')
          .select('user_id, amount')
          .eq('payment_reference', reference)
          .single();
        
        if (txData) {
          // Mark as failed
          await supabase
            .from('transactions')
            .update({ 
              status: 'failed',
              metadata: {
                failure_reason: error.message,
                failed_at: new Date().toISOString()
              }
            })
            .eq('payment_reference', reference);
          
          // REFUND NEEDED! Refund exact debit amount only
          const { data: configData } = await supabase
            .from('platform_config')
            .select('withdrawal_fee')
            .single();
          
          const withdrawalFee = Number(configData?.withdrawal_fee) || 50;
          
          // Refund user the exact debit amount
          await supabase.from('transactions').insert({
            user_id: txData.user_id,
            wallet_type: 'earnings',
            amount: Math.abs(txData.amount), // Refund exactly what was debited
            transaction_type: 'debt_reversal',
            description: `Withdrawal error - refund (Ref: ${reference})`,
            status: 'completed',
            metadata: {
              original_reference: reference,
              refund_reason: 'system_error',
              withdrawal_amount: Math.abs(txData.amount)
            }
          });
          
          // System treasury removed — no fee reversal entry needed.

          
          // Invalidate cache
          await supabase.from('cached_balances').delete().eq('user_id', txData.user_id);
          
          console.log('✅ Transaction marked as failed - refunded amount:', Math.abs(txData.amount), '+ reversed fee:', withdrawalFee);
        }
      } catch (refundError) {
        console.error('❌ Failed to refund user after error:', refundError);
      }
    }
    
    return new Response(
      JSON.stringify({ success: false, error: 'Withdrawal failed. Please try again.', errorCode: 'SERVER_ERROR' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
