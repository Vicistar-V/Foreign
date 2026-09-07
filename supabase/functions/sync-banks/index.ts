import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // =====================================================
    // SECURITY: Verify admin authentication
    // =====================================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client for auth check
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      console.error('❌ Authentication failed:', userError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin role
    const { data: isAdmin, error: roleError } = await supabaseAuth.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (roleError || !isAdmin) {
      console.error('❌ Admin check failed:', roleError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Admin verified:', user.email);
    console.log('🔄 Starting bank list sync from Flutterwave...');

    // Get Flutterwave API key
    const flutterwaveKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
    if (!flutterwaveKey) {
      throw new Error('FLUTTERWAVE_SECRET_KEY not configured');
    }

    // Fetch banks from Flutterwave (Nigerian banks)
    console.log('📡 Fetching banks from Flutterwave API...');
    const response = await fetch('https://api.flutterwave.com/v3/banks/NG', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${flutterwaveKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Flutterwave API error:', response.status, errorText);
      throw new Error(`Flutterwave API error: ${response.status}`);
    }

    const result = await response.json();

    if (result.status !== 'success' || !Array.isArray(result.data)) {
      console.error('Invalid Flutterwave response:', result);
      throw new Error('Invalid response from Flutterwave');
    }

    const banks = result.data;
    console.log(`📦 Received ${banks.length} banks from Flutterwave`);

    // =====================================================
    // STEP 1: DEDUPLICATE Flutterwave data
    // =====================================================
    // Flutterwave sometimes returns duplicate codes
    // Use Map to keep only the LAST occurrence of each code
    const uniqueBanksMap = new Map();
    for (const bank of banks) {
      uniqueBanksMap.set(bank.code, bank);
    }
    const uniqueBanks = Array.from(uniqueBanksMap.values());
    
    console.log(`🧹 After deduplication: ${uniqueBanks.length} unique banks (removed ${banks.length - uniqueBanks.length} duplicates)`);

    // Initialize Supabase client with service role (bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // =====================================================
    // STEP 2: DELETE existing banks for this country
    // =====================================================
    // This ensures stale banks are removed
    console.log('🗑️  Clearing old Nigerian banks...');
    const { error: deleteError } = await supabase
      .from('banks')
      .delete()
      .eq('country', 'NG');

    if (deleteError) {
      console.error('Error deleting old banks:', deleteError);
      throw deleteError;
    }
    console.log('✅ Cleared old bank list');

    // =====================================================
    // STEP 3: INSERT fresh deduplicated list
    // =====================================================
    const banksToInsert = uniqueBanks.map((bank: any) => ({
      code: bank.code,
      name: bank.name,
      country: 'NG',
      updated_at: new Date().toISOString(),
    }));

    console.log(`📝 Inserting ${banksToInsert.length} fresh Nigerian banks...`);
    const batchSize = 100;
    let totalInserted = 0;

    for (let i = 0; i < banksToInsert.length; i += batchSize) {
      const batch = banksToInsert.slice(i, i + batchSize);
      
      const { data: insertedBanks, error: insertError } = await supabase
        .from('banks')
        .insert(batch)
        .select();

      if (insertError) {
        console.error('Error inserting banks batch:', insertError);
        throw insertError;
      }

      totalInserted += insertedBanks?.length || 0;
      console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}: ${insertedBanks?.length || 0} banks`);
    }

    console.log(`✅ Successfully synced ${totalInserted} banks to database`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${totalInserted} banks from Flutterwave`,
        banks_count: totalInserted,
        timestamp: new Date().toISOString(),
        country: 'NG',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('❌ Error syncing banks:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
