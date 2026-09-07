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

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Please log in', errorCode: 'UNAUTHORIZED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Please log in', errorCode: 'UNAUTHORIZED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== CHECK IF USER IS BANNED (FRAUD PREVENTION) ==========
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('is_banned, banned_reason')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Failed to fetch profile:', profileError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to verify account status', errorCode: 'SERVER_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (userProfile?.is_banned) {
      console.log('Banned user attempting to add bank account:', user.id);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Your account has been suspended',
          reason: userProfile.banned_reason || 'Account violation detected',
          banned: true,
          errorCode: 'BANNED'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action = 'add', account_id, bank_code, account_number, pin, verify_only } = await req.json();

    // ========== HANDLE SET PRIMARY ACTION ==========
    if (action === 'set_primary') {
      console.log(`Setting account ${account_id} as primary for user ${user.id}`);
      
      // Verify PIN
      const { data: pinResponse, error: pinError } = await supabase.functions.invoke('verify-pin', {
        body: { pin },
        headers: { Authorization: authHeader },
      });

      if (pinError || !pinResponse?.valid) {
        console.error('PIN verification failed for set_primary:', pinError);
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid PIN', errorCode: 'INVALID_PIN' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Unset all primary accounts for this user
      await supabase
        .from('withdrawal_accounts')
        .update({ is_primary: false })
        .eq('user_id', user.id);

      // Set the specified account as primary
      const { error: updateError } = await supabase
        .from('withdrawal_accounts')
        .update({ is_primary: true })
        .eq('id', account_id)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Failed to set primary account:', updateError);
        throw updateError;
      }

      console.log('Successfully set primary account');
      return new Response(
        JSON.stringify({ success: true, message: 'Primary account updated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== HANDLE DELETE ACTION ==========
    if (action === 'delete') {
      console.log(`Deleting account ${account_id} for user ${user.id}`);
      
      // Verify PIN
      const { data: pinResponse, error: pinError } = await supabase.functions.invoke('verify-pin', {
        body: { pin },
        headers: { Authorization: authHeader },
      });

      if (pinError || !pinResponse?.valid) {
        console.error('PIN verification failed for delete:', pinError);
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid PIN', errorCode: 'INVALID_PIN' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete the account
      const { error: deleteError } = await supabase
        .from('withdrawal_accounts')
        .delete()
        .eq('id', account_id)
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('Failed to delete account:', deleteError);
        throw deleteError;
      }

      console.log('Successfully deleted account');
      return new Response(
        JSON.stringify({ success: true, message: 'Account removed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== HANDLE ADD ACTION (Default) ==========

    console.log(`Add bank account request from user ${user.id}, verify_only: ${verify_only}`);

    // Only verify PIN if we're actually saving (not just verifying)
    if (!verify_only) {
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
    }

    // Validate input
    if (!bank_code || !account_number) {
      return new Response(
        JSON.stringify({ success: false, error: 'Bank code and account number are required', errorCode: 'VALIDATION_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (account_number.length !== 10 || !/^\d+$/.test(account_number)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Account number must be 10 digits', errorCode: 'VALIDATION_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Flutterwave Name Inquiry API
    const flutterwaveKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
    
    // Debug logging - send bank_code as STRING (not parsed to integer)
    console.log('🔍 Bank verification attempt:', {
      bank_code: bank_code,
      bank_code_type: typeof bank_code,
      account_number: account_number,
      is_verify_only: verify_only
    });

    const requestBody = {
      account_number: account_number,
      account_bank: bank_code  // Send as string, don't parse!
    };

    console.log('📤 Sending to Flutterwave:', JSON.stringify(requestBody, null, 2));
    
    const verifyResponse = await fetch('https://api.flutterwave.com/v3/accounts/resolve', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${flutterwaveKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const verifyData = await verifyResponse.json();

    console.log('📥 Flutterwave response:', {
      status: verifyResponse.status,
      ok: verifyResponse.ok,
      data: verifyData
    });

    if (!verifyResponse.ok || verifyData.status !== 'success') {
      console.error('❌ Bank verification failed:', {
        status: verifyResponse.status,
        response_data: verifyData,
        sent_bank_code: bank_code,
        sent_account_number: account_number
      });
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Could not verify bank account. Please check your details.',
          details: verifyData.message || 'Unknown error',
          errorCode: 'VALIDATION_ERROR'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const bankAccountName = verifyData.data.account_name;

    // Look up the correct bank name from the banks table using bank_code
    const { data: bankData, error: bankLookupError } = await supabase
      .from('banks')
      .select('name')
      .eq('code', bank_code)
      .single();

    if (bankLookupError || !bankData) {
      console.error('Failed to look up bank name:', bankLookupError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to find bank information', errorCode: 'VALIDATION_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const bankName = bankData.name;

    console.log('✅ Bank verification successful:', {
      account_name: bankAccountName,
      bank_code: bank_code,
      bank_name: bankName
    });

    // Name-matching restriction removed — PIN protects withdrawals.
    // We still fetch the profile for the name-lock flag (kept for backward compatibility).
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, is_name_locked')
      .eq('id', user.id)
      .single();

    console.log('✅ Skipping name match — accepting bank account name as-is:', {
      profile_name: profile?.full_name,
      bank_name: bankAccountName
    });


    // If verify_only mode, return early with just the account name
    if (verify_only) {
      console.log('Verification only - returning account name without saving');
      return new Response(
        JSON.stringify({
          verified: true,
          account_name: bankAccountName,
          bank_name: bankName,
          matches_profile: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is user's first account
    const { data: existingAccounts } = await supabase
      .from('withdrawal_accounts')
      .select('id')
      .eq('user_id', user.id);

    const isFirstAccount = !existingAccounts || existingAccounts.length === 0;

    // Check if this account is already registered by ANOTHER user (fraud prevention)
    const { data: accountUsedByOthers } = await supabase
      .from('withdrawal_accounts')
      .select('id')
      .eq('account_number', account_number)
      .eq('bank_code', bank_code)
      .neq('user_id', user.id)
      .maybeSingle();

    if (accountUsedByOthers) {
      console.log('Account already registered by another user:', account_number);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'account_already_registered',
          message: 'This bank account is already registered on another Viketa account. Each bank account can only be linked to one account for security.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this account already exists for this user (duplicate check)
    const { data: duplicateAccount } = await supabase
      .from('withdrawal_accounts')
      .select('id, bank_name')
      .eq('user_id', user.id)
      .eq('account_number', account_number)
      .eq('bank_code', bank_code)
      .maybeSingle();

    if (duplicateAccount) {
      console.log('Duplicate account detected:', duplicateAccount);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'duplicate_account',
          message: `This account number is already linked to your profile (${duplicateAccount.bank_name}). Each account can only be added once.`
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert account with both bank_code AND bank_name
    const { data: newAccount, error: insertError } = await supabase
      .from('withdrawal_accounts')
      .insert({
        user_id: user.id,
        bank_code: bank_code,
        bank_name: bankName,
        account_number: account_number,
        account_name: bankAccountName,
        is_verified: true,
        is_primary: isFirstAccount
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Name lock removed — users can keep editing their profile name freely.


    console.log('Bank account added successfully:', newAccount.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Bank account verified and added successfully',
        account: {
          id: newAccount.id,
          bank_name: newAccount.bank_name,
          account_number: newAccount.account_number,
          account_name: newAccount.account_name,
          is_primary: newAccount.is_primary
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in add-bank-account:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message, errorCode: 'SERVER_ERROR' }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
