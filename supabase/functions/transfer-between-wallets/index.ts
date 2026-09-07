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
    // Create Supabase client with service role (needed to call DB function)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // =====================================================
    // STEP 1: AUTHENTICATE USER
    // =====================================================
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ No authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated', errorCode: 'UNAUTHORIZED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      console.error('❌ Authentication error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated', errorCode: 'UNAUTHORIZED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User authenticated:', user.id);

    // =====================================================
    // STEP 2: PARSE AND VALIDATE REQUEST
    // =====================================================
    
    const { fromWallet, toWallet, amount, pin } = await req.json();

    if (!fromWallet || !toWallet || !amount || !pin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: fromWallet, toWallet, amount, pin', errorCode: 'VALIDATION_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Amount must be a positive number', errorCode: 'VALIDATION_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate wallet types
    const validWallets = ['earnings', 'deposit'];
    if (!validWallets.includes(fromWallet) || !validWallets.includes(toWallet)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid wallet type. Only earnings and deposit are allowed.', errorCode: 'VALIDATION_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (fromWallet === toWallet) {
      return new Response(
        JSON.stringify({ success: false, error: 'Source and destination wallets must be different', errorCode: 'VALIDATION_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`💸 Transfer request: ₦${amountNum} from ${fromWallet} to ${toWallet}`);

    // =====================================================
    // STEP 2.5: MEMBERSHIP CHECK FOR EARNINGS TRANSFERS
    // =====================================================

    // Fetch user profile to check membership status and banned status
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('is_member, is_banned, banned_reason')
      .eq('id', user.id)
      .single();

    // Check if user is banned
    if (userProfile?.is_banned) {
      console.error('❌ User is banned:', user.id);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Your account has been suspended',
          details: userProfile.banned_reason || 'Account violation detected',
          errorCode: 'BANNED'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL BUSINESS LOGIC:
    // Non-members CANNOT transfer FROM earnings wallet
    // This prevents siphoning referral bonuses before paying membership
    // Scenario: User gets ₦500 referral bonus, transfers to deposit, then withdraws
    // Without this check: User could bypass membership requirement
    // With this check: Earnings are "locked" until membership is paid
    if (fromWallet === 'earnings' && !userProfile?.is_member) {
      console.log('❌ Transfer blocked - non-member trying to move earnings:', user.id);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Membership Required',
          details: 'You must activate your membership (₦1,000) before you can transfer or withdraw your earnings. This protects the community.',
          errorCode: 'NOT_MEMBER'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // NOTE: Transfers FROM deposit are allowed regardless of membership
    // (User's own money - they should be able to move it)

    // =====================================================
    // STEP 3: VERIFY PIN
    // =====================================================
    
    console.log('🔐 Verifying PIN...');
    
    const { data: pinData, error: pinError } = await supabase.functions.invoke('verify-pin', {
      body: { pin },
      headers: {
        Authorization: authHeader,
      },
    });

    if (pinError || !pinData || !pinData.valid) {
      console.error('❌ PIN verification failed:', pinError || 'Invalid PIN');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid PIN', errorCode: 'INVALID_PIN' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ PIN verified');

    // =====================================================
    // STEP 4: EXECUTE ATOMIC TRANSFER (Database Function)
    // =====================================================
    
    console.log('⚡ Executing atomic transfer...');
    
    const { data: transferResult, error: transferError } = await supabase.rpc(
      'atomic_wallet_transfer',
      {
        _user_id: user.id,
        _from_wallet: fromWallet,
        _to_wallet: toWallet,
        _amount: amountNum,
        _description: `Internal transfer: ${fromWallet} → ${toWallet}`,
      }
    );

    if (transferError) {
      console.error('❌ Transfer failed:', transferError);
      
      // Extract user-friendly error messages
      let errorMessage = transferError.message;
      if (errorMessage.includes('Insufficient funds')) {
        errorMessage = 'Insufficient funds in source wallet';
      } else if (errorMessage.includes('Credits cannot be transferred')) {
        errorMessage = 'Credits cannot be transferred. They can only be used for drops.';
      }
      
      return new Response(
        JSON.stringify({ success: false, error: errorMessage, errorCode: 'TRANSFER_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Transfer completed successfully:', transferResult);

    // =====================================================
    // STEP 5: RETURN SUCCESS
    // =====================================================
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully transferred ₦${amountNum} from ${fromWallet} to ${toWallet}`,
        data: transferResult,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('💥 Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'An unexpected error occurred', errorCode: 'SERVER_ERROR' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
