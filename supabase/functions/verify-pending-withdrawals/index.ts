import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async () => {
  console.log('🤖 Background worker: Checking pending withdrawals...');

  try {
    // STEP 1: Check if manual withdrawal mode is ON
    const { data: config, error: configError } = await supabase
      .from('platform_config')
      .select('manual_withdrawal_mode')
      .eq('id', 1)
      .single();
    
    if (configError) {
      console.error('❌ Failed to fetch platform config:', configError);
      throw configError;
    }
    
    const isManualMode = config?.manual_withdrawal_mode || false;
    console.log(`📋 Manual Withdrawal Mode: ${isManualMode ? 'ON' : 'OFF'}`);

    // STEP 2: Get all pending withdrawals
    const { data: pendingTransactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('transaction_type', 'withdrawal')
      .eq('status', 'pending');

    if (error) throw error;

    if (!pendingTransactions || pendingTransactions.length === 0) {
      console.log('✅ No pending withdrawals to check');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No pending withdrawals',
          checked: 0 
        }), 
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`📊 Found ${pendingTransactions.length} pending withdrawal(s)`);

    // STEP 3: ALWAYS filter out manual withdrawals — regardless of current
    // platform setting. The flag is stamped at submission time and is permanent
    // for that transaction. Toggling manual_withdrawal_mode later must NEVER
    // cause a previously-manual withdrawal to be auto-pushed to Flutterwave.
    const isManualTx = (tx: any) =>
      tx.metadata?.is_manual === true ||
      tx.metadata?.manual_mode === true ||
      tx.metadata?.awaiting_admin_approval === true;

    let transactionsToCheck = pendingTransactions.filter(tx => {
      if (isManualTx(tx)) {
        console.log(`⏭️ Skipping manual withdrawal ${tx.payment_reference} - awaiting admin action (mode=${isManualMode ? 'ON' : 'OFF'})`);
        return false;
      }
      return true;
    });

    const skippedCount = pendingTransactions.length - transactionsToCheck.length;
    if (skippedCount > 0) {
      console.log(`📋 Skipped ${skippedCount} manual withdrawal(s) - they need admin approval`);
    }

    if (transactionsToCheck.length === 0) {
      console.log('✅ All pending withdrawals are manual - waiting for admin action');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'All withdrawals are manual, awaiting admin action',
          total: pendingTransactions.length,
          skipped_manual: pendingTransactions.length,
          checked: 0 
        }), 
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    let successCount = 0;
    let errorCount = 0;

    // STEP 4: Check each non-manual withdrawal
    for (const tx of transactionsToCheck) {
      const reference = tx.payment_reference;
      
      if (!reference) {
        console.warn(`⚠️ Skipping transaction ${tx.id} - no payment reference`);
        continue;
      }
      
      console.log(`🔍 Checking ${reference}...`);
      
      try {
        // Call the verification endpoint (internal call)
        const response = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/flutterwave-callback?type=withdrawal&reference=${reference}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            }
          }
        );

        const result = await response.json();
        console.log(`✅ ${reference}: ${result.status} - ${result.message}`);
        successCount++;
      } catch (err) {
        console.error(`❌ Error checking ${reference}:`, err);
        errorCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const skippedManual = pendingTransactions.length - transactionsToCheck.length;
    console.log(`✅ Worker completed: ${successCount} checked, ${errorCount} errors, ${skippedManual} manual (skipped)`);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        total: pendingTransactions.length,
        checked: successCount,
        errors: errorCount,
        skipped_manual: skippedManual
      }), 
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('💥 Worker error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
