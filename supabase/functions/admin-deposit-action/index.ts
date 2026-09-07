import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the user from the token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { transactionId, action, reason } = await req.json();

    if (!transactionId || !action) {
      return new Response(JSON.stringify({ error: 'Missing transactionId or action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('admin-deposit-action:', { transactionId, action, adminId: user.id });

    // Get the transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('transaction_type', 'deposit')
      .single();

    if (txError || !transaction) {
      return new Response(JSON.stringify({ error: 'Deposit not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let result;

    switch (action) {
      case 'verify': {
        // Check Flutterwave payment status
        const txRef = transaction.payment_reference;
        
        if (!txRef) {
          result = { 
            status: 'unknown', 
            message: 'No payment reference found' 
          };
          break;
        }

        const FLW_SECRET_KEY = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
        const flwResponse = await fetch(
          `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${txRef}`,
          {
            headers: {
              'Authorization': `Bearer ${FLW_SECRET_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const flwData = await flwResponse.json();
        console.log('Flutterwave verification:', flwData);

        if (flwData.status === 'success' && flwData.data?.status === 'successful') {
          // Payment was successful
          if (transaction.status !== 'completed') {
            await supabase
              .from('transactions')
              .update({
                status: 'completed',
                metadata: {
                  ...transaction.metadata,
                  verified_at: new Date().toISOString(),
                  verified_by: user.id,
                  flutterwave_data: flwData.data
                }
              })
              .eq('id', transactionId);

            result = { 
              status: 'completed', 
              message: `Payment verified! ₦${flwData.data.amount} received.` 
            };
          } else {
            result = { 
              status: 'already_completed', 
              message: 'This deposit was already completed.' 
            };
          }
        } else {
          result = { 
            status: flwData.data?.status || 'unknown', 
            message: `Payment status: ${flwData.data?.status || 'Unable to verify'}` 
          };
        }
        break;
      }

      case 'complete': {
        // Manually mark as complete
        if (transaction.status === 'completed') {
          result = { status: 'already_completed', message: 'Deposit already completed' };
          break;
        }

        await supabase
          .from('transactions')
          .update({
            status: 'completed',
            metadata: {
              ...transaction.metadata,
              manually_completed_at: new Date().toISOString(),
              manually_completed_by: user.id,
              completion_reason: reason || 'Manual admin completion'
            }
          })
          .eq('id', transactionId);

        result = { status: 'completed', message: 'Deposit marked as complete' };
        break;
      }

      case 'reject': {
        // Mark as failed
        if (transaction.status === 'completed') {
          result = { status: 'error', message: 'Cannot reject a completed deposit' };
          break;
        }

        await supabase
          .from('transactions')
          .update({
            status: 'failed',
            metadata: {
              ...transaction.metadata,
              rejected_at: new Date().toISOString(),
              rejected_by: user.id,
              rejection_reason: reason || 'Rejected by admin'
            }
          })
          .eq('id', transactionId);

        result = { status: 'rejected', message: 'Deposit rejected' };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    console.log('admin-deposit-action: Complete', result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('admin-deposit-action: Error', error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
