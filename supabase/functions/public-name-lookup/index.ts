import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This is a PUBLIC endpoint - no auth required
// Used during signup to fetch name from bank account

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bank_code, account_number } = await req.json();

    console.log('🔍 Public name lookup request:', {
      bank_code,
      account_number_length: account_number?.length
    });

    // Validate input
    if (!bank_code || !account_number) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Bank code and account number are required' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (account_number.length !== 10 || !/^\d+$/.test(account_number)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Account number must be exactly 10 digits' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get bank name from our database for display
    const { data: bankData, error: bankError } = await supabase
      .from('banks')
      .select('name')
      .eq('code', bank_code)
      .single();

    if (bankError || !bankData) {
      console.error('Bank lookup failed:', bankError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid bank selected' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const bankName = bankData.name;

    // Call Flutterwave Name Inquiry API
    const flutterwaveKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
    
    if (!flutterwaveKey) {
      console.error('FLUTTERWAVE_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Payment service not configured' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📤 Resolving account with ${bankName}...`);
    
    const verifyResponse = await fetch('https://api.flutterwave.com/v3/accounts/resolve', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${flutterwaveKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        account_number: account_number,
        account_bank: bank_code
      })
    });

    const verifyData = await verifyResponse.json();

    console.log('📥 Flutterwave response:', {
      status: verifyResponse.status,
      ok: verifyResponse.ok,
      data_status: verifyData.status
    });

    if (!verifyResponse.ok || verifyData.status !== 'success') {
      console.error('❌ Account lookup failed:', verifyData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not find this account. Please check your bank and account number.',
          flutterwave_message: verifyData.message
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountName = verifyData.data.account_name;
    
    console.log('✅ Account resolved successfully:', {
      account_name: accountName,
      bank_name: bankName
    });

    return new Response(
      JSON.stringify({
        success: true,
        account_name: accountName,
        bank_name: bankName,
        bank_code: bank_code
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in public-name-lookup:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Something went wrong. Please try again.' 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
